import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { db } from "@/lib/db";
import { getPublicSoups } from "@/lib/public-soups";
import { createRsvp } from "@/lib/rsvp";

import { clearRsvps } from "./database";

// The query and public projection are real; Next.js owns the cache at runtime.
vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));

beforeEach(clearRsvps);
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.$disconnect());

async function register(name = "Minestrone", attendeeName = "Ada Lovelace", secondName: string | null = null) {
  return createRsvp({ attendeeName, secondName, status: "ATTENDING", soup: { name } });
}

describe("public soup registry", () => {
  it("returns an empty list when no soups have been registered", async () => {
    expect(await getPublicSoups()).toEqual([]);
  });

  it("exposes only the soup's name and the contributors' first names", async () => {
    const { id, editToken } = await register("Minestrone", "Ada Lovelace", "Charles Babbage");
    const rsvp = await db.rsvp.findUniqueOrThrow({ where: { id }, include: { soup: true } });
    const soups = await getPublicSoups();

    expect(soups).toEqual([{ name: "Minestrone", contributorName: "Ada and Charles" }]);
    for (const privateValue of [id, editToken, rsvp.editTokenHash, rsvp.soup!.id, "Lovelace", "Babbage"]) {
      expect(JSON.stringify(soups)).not.toContain(privateValue);
    }
  });

  it("omits declined guests' soups and attending guests who have not chosen a soup", async () => {
    const { id } = await register("Hidden soup", "Grace Hopper");
    await db.rsvp.update({ where: { id }, data: { status: "DECLINED", partySize: null } });
    await createRsvp({ attendeeName: "Alan Turing", secondName: null, status: "ATTENDING", soup: null });
    await register();

    expect((await getPublicSoups()).map(({ name }) => name)).toEqual(["Minestrone"]);
  });

  it("lists soups alphabetically and retains duplicate names", async () => {
    await register("Zucchini");
    await register("Bean", "Grace Hopper");
    await register("Bean", "李");

    expect((await getPublicSoups()).map(({ name, contributorName }) => [name, contributorName]))
      .toEqual([["Bean", "Grace"], ["Bean", "李"], ["Zucchini", "Ada"]]);
  });

  it("reflects registrations, soup edits, declines, and deleted RSVPs", async () => {
    const { id } = await register();
    expect(await getPublicSoups()).toHaveLength(1);
    await db.soup.update({ where: { rsvpId: id }, data: { name: "Tomato" } });
    expect(await getPublicSoups()).toMatchObject([{ name: "Tomato" }]);
    await db.rsvp.update({ where: { id }, data: { status: "DECLINED", partySize: null } });
    expect(await getPublicSoups()).toEqual([]);
    await db.rsvp.update({ where: { id }, data: { status: "ATTENDING", partySize: 1 } });
    expect(await getPublicSoups()).toHaveLength(1);
    await db.rsvp.delete({ where: { id } });
    expect(await getPublicSoups()).toEqual([]);
  });

  it("returns an empty list on previews without a database", async () => {
    await register();
    vi.stubEnv("DATABASE_URL", "");
    expect(await getPublicSoups()).toEqual([]);
  });
});
