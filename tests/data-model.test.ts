import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { db } from "@/lib/db";

import { clearRsvps } from "./database";

let tokenCount = 0;

function attending(
  overrides: { attendeeName?: string; secondName?: string; partySize?: number | null } = {},
) {
  return {
    attendeeName: "Ada Lovelace",
    status: "ATTENDING" as const,
    partySize: 1,
    editTokenHash: `test-hash-${++tokenCount}`,
    ...overrides,
  };
}

const minestrone = { name: "Minestrone", normalizedName: "minestrone" };

beforeEach(async () => {
  await clearRsvps();
  await db.event.update({
    where: { id: 1 },
    data: { startsAt: null, timeZone: null, mapUrl: null },
  });
});

afterAll(async () => {
  await db.$disconnect();
});

describe("Event", () => {
  it("exists after migrating, with details still to be configured", async () => {
    const event = await db.event.findUniqueOrThrow({ where: { id: 1 } });

    expect(event.title).toBe("Soup Party");
    expect(event.startsAt).toBeNull();
    expect(event.address).toBeNull();
  });

  it("allows only one row", async () => {
    await expect(db.event.create({ data: { id: 2, title: "Second Soup Party" } })).rejects.toThrow(
      "events_singleton_check",
    );
    expect(await db.event.count()).toBe(1);
  });

  it("requires a time zone once a start time is set", async () => {
    const startsAt = new Date("2026-11-14T23:00:00Z");

    await expect(db.event.update({ where: { id: 1 }, data: { startsAt } })).rejects.toThrow(
      "events_time_zone_check",
    );

    const event = await db.event.update({
      where: { id: 1 },
      data: { startsAt, timeZone: "America/New_York" },
    });
    expect(event.startsAt).toEqual(startsAt);
  });

  it("accepts only a web address as the map link", async () => {
    await expect(
      db.event.update({ where: { id: 1 }, data: { mapUrl: "javascript:alert(1)" } }),
    ).rejects.toThrow("events_map_url_check");

    const mapUrl = "https://maps.example.com/?q=1+Example+Street";
    const event = await db.event.update({ where: { id: 1 }, data: { mapUrl } });
    expect(event.mapUrl).toBe(mapUrl);
  });
});

describe("Rsvp", () => {
  it("is created with a generated id and timestamps, and can be queried", async () => {
    const created = await db.rsvp.create({ data: attending() });

    expect(created.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(created.createdAt).toBeInstanceOf(Date);

    const found = await db.rsvp.findUniqueOrThrow({
      where: { editTokenHash: created.editTokenHash },
    });
    expect(found).toEqual(created);
  });

  it("advances updatedAt when changed", async () => {
    const created = await db.rsvp.create({ data: attending() });
    // Timestamps have millisecond precision, and both calls can land in one.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const updated = await db.rsvp.update({
      where: { id: created.id },
      data: { attendeeName: "Ada King" },
    });

    expect(updated.attendeeName).toBe("Ada King");
    expect(updated.createdAt).toEqual(created.createdAt);
    expect(updated.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
  });

  it("has a party of the guests named when attending", async () => {
    const secondName = "Charles Babbage";
    for (const data of [
      attending({ partySize: null }),
      attending({ partySize: 0 }),
      attending({ partySize: 2 }),
      attending({ secondName, partySize: 1 }),
      attending({ secondName, partySize: 3 }),
    ]) {
      await expect(db.rsvp.create({ data })).rejects.toThrow("rsvps_party_size_check");
    }

    const couple = await db.rsvp.create({ data: attending({ secondName, partySize: 2 }) });
    expect(couple).toMatchObject({ secondName, partySize: 2 });
  });

  it("rejects a blank second name", async () => {
    await expect(
      db.rsvp.create({ data: attending({ secondName: " ", partySize: 2 }) }),
    ).rejects.toThrow("rsvps_second_name_check");
  });

  it("has no party size when declined", async () => {
    const declined = { ...attending(), status: "DECLINED" as const };

    await expect(db.rsvp.create({ data: declined })).rejects.toThrow("rsvps_party_size_check");

    const created = await db.rsvp.create({ data: { ...declined, partySize: null } });
    expect(created.partySize).toBeNull();
  });

  it("rejects a blank name", async () => {
    await expect(db.rsvp.create({ data: attending({ attendeeName: "  " }) })).rejects.toThrow(
      "rsvps_attendee_name_check",
    );
  });

  it("rejects a repeated edit token hash", async () => {
    const data = attending();
    await db.rsvp.create({ data });

    await expect(db.rsvp.create({ data })).rejects.toThrow("rsvps_edit_token_hash_key");
  });
});

describe("Soup", () => {
  it("is optional", async () => {
    const rsvp = await db.rsvp.create({ data: attending(), include: { soup: true } });

    expect(rsvp.soup).toBeNull();
  });

  it("belongs to one RSVP and is reachable from either side", async () => {
    const rsvp = await db.rsvp.create({
      data: { ...attending(), soup: { create: minestrone } },
      include: { soup: true },
    });

    expect(rsvp.soup).toMatchObject({ ...minestrone, rsvpId: rsvp.id });

    const soups = await db.soup.findMany({
      where: { rsvp: { status: "ATTENDING" } },
      include: { rsvp: { select: { attendeeName: true } } },
    });
    expect(soups).toHaveLength(1);
    expect(soups[0].rsvp.attendeeName).toBe("Ada Lovelace");
  });

  it("is limited to one per RSVP", async () => {
    const rsvp = await db.rsvp.create({ data: { ...attending(), soup: { create: minestrone } } });

    await expect(
      db.soup.create({
        data: { rsvpId: rsvp.id, name: "Gazpacho", normalizedName: "gazpacho" },
      }),
    ).rejects.toThrow("soups_rsvp_id_key");
  });

  it("rejects a blank name", async () => {
    await expect(
      db.rsvp.create({ data: { ...attending(), soup: { create: { ...minestrone, name: " " } } } }),
    ).rejects.toThrow("soups_name_check");
  });

  it("may share a normalized name with another soup", async () => {
    await db.rsvp.create({ data: { ...attending(), soup: { create: minestrone } } });
    await db.rsvp.create({
      data: { ...attending({ attendeeName: "Grace Hopper" }), soup: { create: minestrone } },
    });

    expect(await db.soup.count({ where: { normalizedName: "minestrone" } })).toBe(2);
  });

  it("cannot exist without an RSVP", async () => {
    await expect(
      db.soup.create({
        data: { ...minestrone, rsvpId: "00000000-0000-4000-8000-000000000000" },
      }),
    ).rejects.toThrow("soups_rsvp_id_fkey");
  });

  it("is removed with its RSVP", async () => {
    const rsvp = await db.rsvp.create({ data: { ...attending(), soup: { create: minestrone } } });

    await db.rsvp.delete({ where: { id: rsvp.id } });

    expect(await db.soup.count()).toBe(0);
  });

  it("is kept when its RSVP is declined, but is no longer active", async () => {
    const rsvp = await db.rsvp.create({ data: { ...attending(), soup: { create: minestrone } } });

    await db.rsvp.update({
      where: { id: rsvp.id },
      data: { status: "DECLINED", partySize: null },
    });

    expect(await db.soup.count()).toBe(1);
    expect(await db.soup.count({ where: { rsvp: { status: "ATTENDING" } } })).toBe(0);
  });
});
