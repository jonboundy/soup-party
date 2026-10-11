import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { submitRsvp, editRsvp, cancelGuestRsvp } from "@/app/actions";
import { db } from "@/lib/db";
import { createEditToken } from "@/lib/edit-token";
import { cancelRsvp, createRsvp, getEditableRsvp, updateRsvp } from "@/lib/rsvp";
import { consumeRsvpAttempt, rateLimitIdentity, RSVP_RATE_LIMIT } from "@/lib/rsvp-rate-limit";
import { clearRsvps } from "./database";

vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers({ "x-vercel-forwarded-for": "192.0.2.1" }) }));

const input = {
  attendeeName: "Ada Lovelace", status: "ATTENDING" as const, partySize: 2,
  soup: { name: "Minestrone", category: "VEGETABLE" as const, description: "Beans." },
};
function form(token = createEditToken().token, overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: "Ada Lovelace", attendance: "attending", partySize: "2", soupName: "Minestrone",
    soupCategory: "VEGETABLE", soupDescription: "Beans.", submissionToken: token, ...overrides,
  })) data.set(key, value);
  return data;
}
const submit = (data: FormData) => submitRsvp({ status: "idle" }, data);

beforeEach(async () => { vi.clearAllMocks(); await clearRsvps(); });
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.$disconnect());

describe("submission protection", () => {
  it("returns the same confirmation and private link for simultaneous clicks and retries", async () => {
    const data = form();
    const results = await Promise.all(Array.from({ length: 8 }, () => submit(data)));
    expect(results[0]).toMatchObject({ status: "attending", soup: { name: "Minestrone" } });
    for (const result of results) expect(result).toEqual(results[0]);
    expect(await submit(data)).toEqual(results[0]);
    expect(await db.rsvp.count()).toBe(1);
    expect(await db.soup.count()).toBe(1);
  });

  it("rejects a reused token with different answers and never overwrites", async () => {
    const token = createEditToken().token;
    const results = await Promise.all([
      submit(form(token)),
      submit(form(token, { name: "Grace Hopper", acknowledgedSoupName: "Minestrone" })),
    ]);
    expect(results.map((result) => result.status).sort()).toEqual(["attending", "conflict"]);
    expect(await db.rsvp.count()).toBe(1);
    expect(await db.soup.count()).toBe(1);
    const before = await getEditableRsvp(token);
    expect(await submit(form(token, { partySize: "3" }))).toEqual({ status: "conflict" });
    expect(await getEditableRsvp(token)).toEqual(before);
  });

  it("deduplicates simultaneous declines without storing the submitted soup", async () => {
    const data = form(undefined, { attendance: "declined", partySize: "garbage" });
    const results = await Promise.all([submit(data), submit(data), submit(data)]);
    expect(results[0]).toMatchObject({ status: "declined" });
    for (const result of results) expect(result).toEqual(results[0]);
    expect(await db.rsvp.count()).toBe(1);
    expect(await db.soup.count()).toBe(0);
  });

  it("preserves later edits and cancellation when an old creation request is replayed", async () => {
    const token = createEditToken().token;
    const data = form(token);
    const original = await submit(data);
    await updateRsvp(token, { ...input, attendeeName: "Ada Byron", partySize: 4, soup: null });
    expect(await submit(data)).toEqual(original);
    expect(await getEditableRsvp(token)).toMatchObject({ attendeeName: "Ada Byron", partySize: 4, soup: null });
    await cancelRsvp(token);
    expect(await submit(data)).toEqual(original);
    expect(await getEditableRsvp(token)).toMatchObject({ status: "DECLINED", partySize: null });
    expect(await db.rsvp.count()).toBe(1);
  });

  it("does not consume a token on validation or duplicate warnings", async () => {
    await createRsvp(input);
    const token = createEditToken().token;
    expect(await submit(form(token, { name: "" }))).toMatchObject({ status: "invalid" });
    expect(await submit(form(token))).toMatchObject({ status: "duplicate" });
    expect(await submit(form(token, { acknowledgedSoupName: "Minestrone" }))).toMatchObject({ status: "attending" });
    expect(await db.rsvp.count()).toBe(2);
  });

  it("rejects missing, malformed and repeated submission credentials", async () => {
    for (const token of ["", "123", "x".repeat(1000)]) expect(await submit(form(token))).toEqual({ status: "failed" });
    const missing = form(); missing.delete("submissionToken");
    expect(await submit(missing)).toEqual({ status: "failed" });
    const repeated = form(); repeated.append("submissionToken", createEditToken().token);
    expect(await submit(repeated)).toEqual({ status: "failed" });
    expect(await db.rsvp.count()).toBe(0);
  });

  it("rejects files, repeated fields, NUL characters and oversized text without writing", async () => {
    const repeated = form(); repeated.append("name", "Grace");
    expect(await submit(repeated)).toMatchObject({ status: "invalid", errors: { name: expect.any(String) } });
    const file = form(); file.set("soupName", new Blob(["Soup"]), "soup.txt");
    expect(await submit(file)).toMatchObject({ status: "invalid", errors: { soupName: expect.any(String) } });
    for (const field of ["name", "soupName", "soupDescription"]) {
      expect(await submit(form(undefined, { [field]: "Bad\0text" }))).toMatchObject({ status: "invalid", errors: { [field]: expect.any(String) } });
      expect(await submit(form(undefined, { [field]: "a".repeat(1000) }))).toMatchObject({ status: "invalid" });
    }
    expect(await db.rsvp.count()).toBe(0);
  });

  it("rejects the honeypot on creation, edit and cancellation", async () => {
    expect(await submit(form(undefined, { website: "https://spam.example" }))).toEqual({ status: "failed" });
    const { editToken } = await createRsvp(input);
    const data = form(undefined, { editToken, website: "spam", confirmCancel: "yes" });
    expect(await editRsvp({ status: "idle" }, data)).toEqual({ status: "failed" });
    expect(await cancelGuestRsvp({ status: "idle" }, data)).toEqual({ status: "failed" });
    expect(await getEditableRsvp(editToken)).toEqual(input);
  });

  it("serializes concurrent edits so name, party and soup come from one complete update", async () => {
    const { editToken } = await createRsvp({ ...input, soup: null });
    const updates = Array.from({ length: 5 }, (_, index) => ({
      ...input, attendeeName: `Guest ${index}`, partySize: index + 1,
      soup: { ...input.soup, name: `Soup ${index}`, description: `Batch ${index}` },
    }));
    expect(await Promise.all(updates.map((update) => updateRsvp(editToken, update)))).toEqual(updates.map(() => true));
    expect(updates).toContainEqual(await getEditableRsvp(editToken));
    expect(await db.soup.count()).toBe(1);
  });

  it("keeps concurrent editing and cancellation consistent, including soup retention", async () => {
    const { editToken } = await createRsvp(input);
    const update = { ...input, attendeeName: "Ada Byron", partySize: 5, soup: { ...input.soup, name: "Tomato" } };
    expect(await Promise.all([updateRsvp(editToken, update), cancelRsvp(editToken)])).toEqual([true, true]);
    const saved = await getEditableRsvp(editToken);
    expect(saved).toMatchObject({ attendeeName: "Ada Byron", soup: update.soup });
    expect(saved?.partySize).toBe(saved?.status === "ATTENDING" ? 5 : null);
    expect(await db.soup.count()).toBe(1);
  });
});

describe("shared request limits", () => {
  it("stops writes when the limiter is unavailable", async () => {
    const { editToken } = await createRsvp(input);
    const unavailable = vi.spyOn(db, "$executeRaw").mockRejectedValue(new Error("Unavailable"));
    try {
      expect(await submit(form())).toEqual({ status: "failed" });
      const data = form(undefined, { editToken, partySize: "4", confirmCancel: "yes" });
      expect(await editRsvp({ status: "idle" }, data)).toEqual({ status: "failed" });
      expect(await cancelGuestRsvp({ status: "idle" }, data)).toEqual({ status: "failed" });
      expect(await getEditableRsvp(editToken)).toEqual(input);
      expect(await db.rsvp.count()).toBe(1);
    } finally {
      unavailable.mockRestore();
    }
  });

  it("permits exactly the budget during simultaneous requests, keeps only hashed keys", async () => {
    const identity = "ip:192.0.2.55";
    const outcomes = await Promise.all(Array.from({ length: RSVP_RATE_LIMIT + 5 }, () => consumeRsvpAttempt(identity)));
    expect(outcomes.filter((outcome) => outcome === null)).toHaveLength(RSVP_RATE_LIMIT);
    expect(outcomes.filter((outcome) => outcome !== null)).toHaveLength(5);
    expect(await consumeRsvpAttempt("ip:192.0.2.56")).toBeNull();
    const rows = await db.rsvpRateLimit.findMany();
    expect(rows.every((row) => /^[0-9a-f]{64}$/.test(row.key))).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("192.0.2.");
  });

  it("resets expired windows and removes old buckets", async () => {
    await consumeRsvpAttempt("ip:192.0.2.55");
    await db.rsvpRateLimit.updateMany({ data: { attempts: 100, windowStart: new Date(Date.now() - 601_000) } });
    expect(await consumeRsvpAttempt("ip:192.0.2.55")).toBeNull();
    expect(await db.rsvpRateLimit.findFirst()).toMatchObject({ attempts: 1 });
    await db.rsvpRateLimit.updateMany({ data: { windowStart: new Date(Date.now() - 86_401_000) } });
    await consumeRsvpAttempt("ip:192.0.2.56");
    expect(await db.rsvpRateLimit.count()).toBe(1);
  });

  it("returns a useful retry time and prevents all mutations when throttled", async () => {
    vi.stubEnv("VERCEL", "1");
    await Promise.all(Array.from({ length: RSVP_RATE_LIMIT }, () => consumeRsvpAttempt("ip:192.0.2.1")));
    expect(await submit(form())).toEqual({ status: "rate-limited", retryAfter: expect.any(Number) });
    expect(await db.rsvp.count()).toBe(0);
    const { editToken } = await createRsvp(input);
    const data = form(undefined, { editToken, partySize: "4", confirmCancel: "yes" });
    expect(await editRsvp({ status: "idle" }, data)).toMatchObject({ status: "rate-limited" });
    expect(await cancelGuestRsvp({ status: "idle" }, data)).toMatchObject({ status: "rate-limited" });
    expect(await getEditableRsvp(editToken)).toEqual(input);
  });

  it("counts invalid submissions too", async () => {
    vi.stubEnv("VERCEL", "1");
    for (let i = 0; i < RSVP_RATE_LIMIT; i++) expect(await submit(form(undefined, { name: "" }))).toMatchObject({ status: "invalid" });
    expect(await submit(form())).toMatchObject({ status: "rate-limited" });
    expect(await db.rsvp.count()).toBe(0);
  });

  it("trusts only the deployment-controlled IP header and uses a shared fallback", () => {
    const headers = new Headers({ "x-forwarded-for": "192.0.2.99", "x-vercel-forwarded-for": "192.0.2.1" });
    vi.stubEnv("VERCEL", "");
    expect(rateLimitIdentity(headers)).toBe("shared");
    vi.stubEnv("VERCEL", "1");
    expect(rateLimitIdentity(headers)).toBe("ip:192.0.2.1");
    headers.delete("x-vercel-forwarded-for");
    expect(rateLimitIdentity(headers)).toBe("shared");
    headers.set("x-vercel-forwarded-for", "192.0.2.1, 192.0.2.2");
    expect(rateLimitIdentity(headers)).toBe("shared");
  });
});
