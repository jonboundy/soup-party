import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cancelGuestRsvp, editRsvp, submitRsvp } from "@/app/actions";
import { db } from "@/lib/db";
import { createEditToken } from "@/lib/edit-token";
import { getRememberedRsvp, RSVP_COOKIE, RSVP_COOKIE_SECONDS } from "@/lib/remembered-rsvp";
import { createRsvp, updateRsvp } from "@/lib/rsvp";
import { addRecipePhoto } from "@/lib/recipe-photos";
import { hashEditToken } from "@/lib/edit-token";
import { clearRsvps, soupNamed } from "./database";
import { testJpeg } from "./jpeg-fixture";

const jar = vi.hoisted(() => ({ values: new Map<string, string>(), set: vi.fn() }));
vi.mock("next/cache", () => ({ refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
  cookies: async () => ({
    get: (name: string) => jar.values.has(name) ? { value: jar.values.get(name) } : undefined,
    set: jar.set,
  }),
}));

const guest = { attendeeName: "Ada Lovelace", secondName: "Charles Babbage", status: "ATTENDING" as const };
function form(token: string, overrides: Record<string, string> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    name: guest.attendeeName, secondName: guest.secondName, soupName: "",
    submissionToken: token, ...overrides,
  })) data.set(key, value);
  return data;
}
const idle = { status: "idle" as const };

beforeEach(async () => {
  vi.clearAllMocks();
  jar.values.clear();
  jar.set.mockImplementation((name: string, value: string) => jar.values.set(name, value));
  await clearRsvps();
});
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.$disconnect());

describe("remembering the guest's RSVP", () => {
  it("remembers a successful RSVP without a soup and restores its receipt", async () => {
    const token = createEditToken().token;
    expect(await submitRsvp(idle, form(token))).toMatchObject({ status: "attending" });
    expect(jar.set).toHaveBeenCalledWith(RSVP_COOKIE, token, {
      httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: RSVP_COOKIE_SECONDS,
    });
    expect(await getRememberedRsvp()).toEqual({ status: "remembered", receipt: {
      status: "attending", name: guest.attendeeName, secondName: guest.secondName,
      soup: null, editPath: `/rsvp/edit?token=${token}`, photos: { saved: 0, unsaved: 0 },
    } });
    expect(await db.rsvp.count()).toBe(1);
  });

  it("does not remember rejected answers or a duplicate-soup warning", async () => {
    const token = createEditToken().token;
    expect(await submitRsvp(idle, form(token, { name: "" }))).toMatchObject({ status: "invalid" });
    await createRsvp({ ...guest, soup: soupNamed("Minestrone") });
    expect(await submitRsvp(idle, form(token, { soupName: "Minestrone" }))).toMatchObject({ status: "duplicate" });
    expect(jar.set).not.toHaveBeenCalled();
    expect(await getRememberedRsvp()).toEqual({ status: "new" });
  });

  it("remembers an RSVP on a successful edit from a private link", async () => {
    const { editToken } = await createRsvp({ ...guest, soup: null });
    expect(await editRsvp(idle, form(editToken, { editToken, name: "Ada Byron" }))).toMatchObject({ status: "attending" });
    expect(await getRememberedRsvp()).toMatchObject({ status: "remembered", receipt: { name: "Ada Byron" } });
  });

  it("keeps a cancellation remembered and restores the same response from its link", async () => {
    const { editToken } = await createRsvp({ ...guest, soup: soupNamed("Tomato") });
    expect(await cancelGuestRsvp(idle, form(editToken, { editToken, confirmCancel: "yes" }))).toMatchObject({ status: "cancelled" });
    expect(await getRememberedRsvp()).toMatchObject({ status: "remembered", receipt: {
      status: "cancelled", unlistedSoup: "Tomato", editPath: `/rsvp/edit?token=${editToken}`,
    } });
    await editRsvp(idle, form(editToken, { editToken, soupName: "Tomato" }));
    expect(await getRememberedRsvp()).toMatchObject({ status: "remembered", receipt: { status: "attending", soup: { name: "Tomato" } } });
    expect(await db.rsvp.count()).toBe(1);
  });

  it("reads current answers rather than retaining an old receipt in the cookie", async () => {
    const { editToken } = await createRsvp({ ...guest, soup: null });
    jar.values.set(RSVP_COOKIE, editToken);
    await updateRsvp(editToken, { ...guest, attendeeName: "Ada Byron", soup: soupNamed("Tomato", { recipeText: "Simmer." }) });
    expect(await getRememberedRsvp()).toMatchObject({ status: "remembered", receipt: {
      name: "Ada Byron", soup: { name: "Tomato", recipeText: "Simmer." },
    } });
  });

  it("includes saved recipe photos in the returning guest's receipt", async () => {
    const { editToken } = await createRsvp({ ...guest, soup: soupNamed("Tomato") });
    await addRecipePhoto({ editTokenHash: hashEditToken(editToken) }, { bytes: testJpeg(), width: 2, height: 3 });
    jar.values.set(RSVP_COOKIE, editToken);
    expect(await getRememberedRsvp()).toMatchObject({ status: "remembered", receipt: { photos: { saved: 1, unsaved: 0 } } });
  });

  it("ignores missing, malformed and unknown cookies, and removed responses", async () => {
    expect(await getRememberedRsvp()).toEqual({ status: "new" });
    for (const token of ["bad", createEditToken().token]) {
      jar.values.set(RSVP_COOKIE, token);
      expect(await getRememberedRsvp()).toEqual({ status: "new" });
    }
    const { id, editToken } = await createRsvp({ ...guest, soup: null });
    jar.values.set(RSVP_COOKIE, editToken);
    await db.rsvp.delete({ where: { id } });
    expect(await getRememberedRsvp()).toEqual({ status: "new" });
  });

  it("does not offer another RSVP when a remembered response cannot be loaded", async () => {
    const { editToken } = await createRsvp({ ...guest, soup: null });
    jar.values.set(RSVP_COOKIE, editToken);
    const unavailable = vi.spyOn(db.rsvp, "findUnique").mockRejectedValueOnce(new Error("Unavailable"));
    try { expect(await getRememberedRsvp()).toEqual({ status: "unavailable" }); }
    finally { unavailable.mockRestore(); }
    vi.stubEnv("DATABASE_URL", "");
    expect(await getRememberedRsvp()).toEqual({ status: "unavailable" });
  });
});
