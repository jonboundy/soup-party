import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { getHostOverview } from "@/lib/host-rsvps";
import { cancelRsvp, createRsvp, updateRsvp } from "@/lib/rsvp";

import { clearRsvps } from "./database";

const host = vi.hoisted(() => ({ signedIn: true }));
vi.mock("@/lib/host-session", () => ({
  requireHost: async () => {
    if (!host.signedIn) throw new Error("redirect:/host");
  },
}));

beforeEach(async () => {
  host.signedIn = true;
  await clearRsvps();
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => db.$disconnect());

const minestrone = { name: "Minestrone", category: "VEGETABLE", description: "Beans.\nNo pasta." } as const;

describe("host overview", () => {
  it("is empty, with every figure at zero, before anyone has responded", async () => {
    expect(await getHostOverview()).toMatchObject({
      counts: { guests: 0, attending: 0, declined: 0, soups: 0, undecided: 0 },
      attending: [], declined: [], soups: [], undecided: [],
    });
  });

  it("is refused to anyone but the signed-in host, before any RSVP is read", async () => {
    await createRsvp({ attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: minestrone });
    const read = vi.spyOn(db.rsvp, "findMany");
    host.signedIn = false;
    await expect(getHostOverview()).rejects.toThrow("redirect:/host");
    expect(read).not.toHaveBeenCalled();
  });

  it("counts guests by party size and everything else by response", async () => {
    await createRsvp({ attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 4, soup: minestrone });
    await createRsvp({ attendeeName: "Alan Turing", status: "ATTENDING", partySize: 1, soup: null });
    await createRsvp({ attendeeName: "Grace Hopper", status: "ATTENDING", partySize: 3, soup: null });
    await createRsvp({ attendeeName: "Edsger Dijkstra", status: "DECLINED", partySize: null, soup: null });
    // Declined with a soup on file: neither a soup nor an undecided soup.
    const { editToken } = await createRsvp({
      attendeeName: "Barbara Liskov", status: "ATTENDING", partySize: 5,
      soup: { name: "Borscht", category: "VEGETABLE", description: null },
    });
    await cancelRsvp(editToken);

    const overview = await getHostOverview();
    expect(overview.counts).toEqual({ guests: 8, attending: 3, declined: 2, soups: 1, undecided: 2 });
    expect(overview.attending.map(({ attendeeName }) => attendeeName))
      .toEqual(["Ada Lovelace", "Alan Turing", "Grace Hopper"]);
    expect(overview.undecided.map(({ attendeeName }) => attendeeName)).toEqual(["Alan Turing", "Grace Hopper"]);
    expect(overview.declined.map(({ attendeeName }) => attendeeName)).toEqual(["Edsger Dijkstra", "Barbara Liskov"]);
    expect(overview.soups).toEqual([{ ...minestrone, attendeeName: "Ada Lovelace" }]);
  });

  it("shows each submission in full, including a declined guest's retained soup", async () => {
    const { id, editToken } = await createRsvp({
      attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: minestrone,
    });
    const [rsvp] = (await getHostOverview()).attending;
    expect(rsvp).toEqual({
      id, attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: minestrone,
      createdAt: expect.any(Date), updatedAt: expect.any(Date),
    });

    await cancelRsvp(editToken);
    const { declined, counts } = await getHostOverview();
    expect(declined).toMatchObject([{ id, status: "DECLINED", partySize: null, soup: minestrone }]);
    expect(counts).toEqual({ guests: 0, attending: 0, declined: 1, soups: 0, undecided: 0 });
  });

  it("never includes edit tokens or stored hashes", async () => {
    const { id, editToken } = await createRsvp({
      attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: minestrone,
    });
    const stored = await db.rsvp.findUniqueOrThrow({ where: { id } });
    const overview = JSON.stringify(await getHostOverview());
    for (const secret of [editToken, stored.editTokenHash, stored.submissionHash!]) {
      expect(overview).not.toContain(secret);
    }
  });

  it("lists soups alphabetically with the contributor's full name", async () => {
    await createRsvp({ attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 1, soup: { ...minestrone, name: "Zucchini" } });
    await createRsvp({ attendeeName: "Grace Hopper", status: "ATTENDING", partySize: 1, soup: { ...minestrone, name: "bean" } });
    await createRsvp({ attendeeName: "Alan Turing", status: "ATTENDING", partySize: 1, soup: { ...minestrone, name: "Bean" } });

    expect((await getHostOverview()).soups.map(({ name, attendeeName }) => [name, attendeeName]))
      .toEqual([["bean", "Grace Hopper"], ["Bean", "Alan Turing"], ["Zucchini", "Ada Lovelace"]]);
  });

  it("reflects guest edits on the next read", async () => {
    const { editToken } = await createRsvp({
      attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: null,
    });
    expect((await getHostOverview()).counts).toMatchObject({ guests: 2, soups: 0, undecided: 1 });

    await updateRsvp(editToken, { attendeeName: "Ada King", status: "ATTENDING", partySize: 3, soup: minestrone });
    const overview = await getHostOverview();
    expect(overview.counts).toEqual({ guests: 3, attending: 1, declined: 0, soups: 1, undecided: 0 });
    expect(overview.attending).toMatchObject([{ attendeeName: "Ada King", partySize: 3, soup: minestrone }]);
    expect(overview.attending[0].updatedAt.getTime()).toBeGreaterThan(overview.attending[0].createdAt.getTime());
  });

  it("dates a change to the soup alone", async () => {
    const { id } = await createRsvp({
      attendeeName: "Ada Lovelace", status: "ATTENDING", partySize: 2, soup: minestrone,
    });
    const later = new Date(Date.now() + 60_000);
    await db.soup.update({ where: { rsvpId: id }, data: { name: "Tomato", updatedAt: later } });
    expect((await getHostOverview()).attending[0].updatedAt).toEqual(later);
  });

  it("reports the event's time zone for showing when responses arrived", async () => {
    expect((await getHostOverview()).timeZone).toBeNull();
    await db.event.update({ where: { id: 1 }, data: { timeZone: "America/New_York" } });
    try {
      expect((await getHostOverview()).timeZone).toBe("America/New_York");
    } finally {
      await db.event.update({ where: { id: 1 }, data: { timeZone: null } });
    }
  });
});
