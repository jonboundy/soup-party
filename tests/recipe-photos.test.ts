import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { refresh, updateTag } from "next/cache";

import { addRecipePhoto, cancelGuestRsvp, editRsvp, removeRecipePhoto } from "@/app/actions";
import { GET } from "@/app/soups/[id]/photos/[photoId]/route";
import { db } from "@/lib/db";
import { createEditToken, hashEditToken } from "@/lib/edit-token";
import { getPublicRecipe, getPublicSoups } from "@/lib/public-soups";
import { RECIPE_PHOTO_LIMIT, RECIPE_PHOTO_MAX_BYTES } from "@/lib/recipe-photo";
import { RECIPE_PHOTO_RATE_LIMIT, RSVP_RATE_LIMIT, consumeRecipePhotoAttempt, consumeRsvpAttempt } from "@/lib/rsvp-rate-limit";
import { createRsvp, getEditablePhotos } from "@/lib/rsvp";

import { clearRsvps, soupNamed } from "./database";
import { metadata, photoForm, testJpeg } from "./jpeg-fixture";

vi.mock("next/cache", () => ({ cacheLife: vi.fn(), cacheTag: vi.fn(), refresh: vi.fn(), updateTag: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: vi.fn() }), headers: async () => new Headers({ "x-vercel-forwarded-for": "192.0.2.1" }) }));

const guest = { attendeeName: "Ada Lovelace", secondName: null, status: "ATTENDING" as const };
const fields = { name: "Ada Lovelace", attendance: "attending", soupName: "Minestrone" };

/** An attending guest with a soup, the soup's id, and shorthands for their link's requests. */
async function register(soup = soupNamed("Minestrone")) {
  const { id, editToken } = await createRsvp({ ...guest, soup });
  const soupId = soup ? (await db.soup.findUniqueOrThrow({ where: { rsvpId: id } })).id : "";
  return {
    id, editToken, soupId,
    add: (photo: Uint8Array<ArrayBuffer> | null = testJpeg(), type?: string) =>
      addRecipePhoto(photoForm({ editToken }, photo, type)),
    remove: (photoId: string) => removeRecipePhoto(photoForm({ editToken, photoId })),
    edit: (overrides: Record<string, string> = {}) =>
      editRsvp({ status: "idle" }, photoForm({ ...fields, editToken, ...overrides })),
  };
}

function serve(id: string, photoId: string) {
  return GET(new Request("https://soup.example/"), { params: Promise.resolve({ id, photoId }) });
}

/** The id of a photo that was saved. */
function savedId(result: Awaited<ReturnType<typeof addRecipePhoto>>) {
  if (result.status !== "saved") throw new Error(`Expected a saved photo, not ${result.status}`);
  return result.photo.id;
}

beforeEach(async () => { vi.clearAllMocks(); await clearRsvps(); });
afterEach(() => vi.unstubAllEnvs());
afterAll(async () => db.$disconnect());

describe("recipe photos", () => {
  it("are added with the private link, in order, and make the recipe public", async () => {
    const { editToken, soupId, add } = await register();
    expect(await getPublicSoups()).toMatchObject([{ recipePath: null }]);

    const first = await add(testJpeg({ width: 1200, height: 1600 }));
    const second = await add(testJpeg({ width: 800, height: 600 }));
    const src = (id: string) => `/soups/${soupId}/photos/${id}`;
    expect(first).toEqual({ status: "saved", photo: { id: savedId(first), src: src(savedId(first)) } });

    const photos = [
      { id: savedId(first), src: src(savedId(first)), width: 1200, height: 1600 },
      { id: savedId(second), src: src(savedId(second)), width: 800, height: 600 },
    ];
    expect(await getPublicRecipe(soupId)).toEqual({
      name: "Minestrone", contributorName: "Ada", recipeUrl: null, recipeText: null, photos,
    });
    expect(await getPublicSoups()).toMatchObject([{ recipePath: `/soups/${soupId}` }]);
    expect(await getEditablePhotos(editToken)).toEqual(photos.map(({ id, src }) => ({ id, src })));
    expect(updateTag).toHaveBeenCalledWith("soups");
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("are stored without their metadata, and served as nothing but a JPEG", async () => {
    const { soupId, add } = await register();
    const photoId = savedId(await add(testJpeg({ extra: metadata, trailing: [1, 2, 3] }), "text/html"));

    const response = await serve(soupId, photoId);
    expect(response.status).toBe(200);
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(testJpeg());
    expect(Object.fromEntries(response.headers)).toMatchObject({
      "content-type": "image/jpeg",
      "content-length": String(testJpeg().length),
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'",
      "cache-control": "private, max-age=86400",
    });
  });

  it("are refused unless the file is a JPEG within the limits", async () => {
    const { soupId, editToken, add } = await register();
    const tooBig = testJpeg({ scan: RECIPE_PHOTO_MAX_BYTES });
    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    for (const file of [png, tooBig, testJpeg({ width: 1601 }), testJpeg().slice(0, 40), new Uint8Array(), null]) {
      expect(await add(file)).toEqual({ status: "invalid" });
    }
    // A file's name and declared type are not what make it a photo.
    const twice = photoForm({ editToken }, testJpeg());
    twice.append("photo", new Blob([testJpeg()]));
    expect(await addRecipePhoto(twice)).toEqual({ status: "invalid" });
    expect(await addRecipePhoto(photoForm({ editToken, photo: "minestrone.jpg" }))).toEqual({ status: "invalid" });

    expect(await db.recipePhoto.count()).toBe(0);
    expect(await getPublicRecipe(soupId)).toBeNull();
    expect(updateTag).not.toHaveBeenCalled();
    // One just inside the limit is accepted.
    const largest = testJpeg({ scan: RECIPE_PHOTO_MAX_BYTES - testJpeg({ scan: 0 }).length });
    expect(largest).toHaveLength(RECIPE_PHOTO_MAX_BYTES);
    expect(await add(largest)).toMatchObject({ status: "saved" });
  });

  it("stop at three, however many arrive at once", async () => {
    const { soupId, add } = await register();
    const results = await Promise.all(Array.from({ length: 7 }, () => add()));
    expect(results.filter(({ status }) => status === "saved")).toHaveLength(RECIPE_PHOTO_LIMIT);
    expect(results.filter(({ status }) => status === "full")).toHaveLength(7 - RECIPE_PHOTO_LIMIT);
    expect(await add()).toEqual({ status: "full" });
    expect((await db.recipePhoto.findMany({ orderBy: { position: "asc" } })).map(({ position }) => position))
      .toEqual([0, 1, 2]);
    expect((await getPublicRecipe(soupId))!.photos).toHaveLength(3);
  });

  it("are removed with the private link, which frees a place, and removing twice is safe", async () => {
    const { soupId, add, remove } = await register();
    const [first, second, third] = [savedId(await add()), savedId(await add()), savedId(await add())];
    vi.clearAllMocks();

    expect(await remove(second)).toEqual({ status: "removed" });
    expect(await remove(second)).toEqual({ status: "removed" });
    expect((await getPublicRecipe(soupId))!.photos.map(({ id }) => id)).toEqual([first, third]);
    expect((await serve(soupId, second)).status).toBe(404);
    expect(updateTag).toHaveBeenCalledWith("soups");

    const fourth = savedId(await add());
    expect((await getPublicRecipe(soupId))!.photos.map(({ id }) => id)).toEqual([first, fourth, third]);
    // The last photo gone, a recipe that was only photos is gone too.
    for (const id of [first, third, fourth]) await remove(id);
    expect(await getPublicRecipe(soupId)).toBeNull();
    expect(await getPublicSoups()).toMatchObject([{ recipePath: null }]);
  });

  it("cannot be added or removed without the soup's own link", async () => {
    const ada = await register();
    const grace = await register(soupNamed("Borscht"));
    const photoId = savedId(await ada.add());
    const before = await db.recipePhoto.findMany();
    vi.clearAllMocks();

    for (const editToken of ["", ada.id, ada.soupId, hashEditToken(ada.editToken), createEditToken().token]) {
      expect(await addRecipePhoto(photoForm({ editToken }, testJpeg()))).toEqual({ status: "unauthorized" });
      expect(await removeRecipePhoto(photoForm({ editToken, photoId }))).toEqual({ status: "unauthorized" });
    }
    expect(await addRecipePhoto(photoForm({}, testJpeg()))).toEqual({ status: "unauthorized" });
    expect(await addRecipePhoto({} as FormData)).toEqual({ status: "unauthorized" });
    // Another guest's link is a real one, but the photo is not theirs.
    expect(await grace.remove(photoId)).toEqual({ status: "removed" });
    for (const other of ["", "minestrone", ada.soupId, "' OR 1=1 --"]) {
      expect(await ada.remove(other)).toEqual({ status: "removed" });
    }

    expect(await db.recipePhoto.findMany()).toEqual(before);
    expect(await getEditablePhotos(grace.editToken)).toEqual([]);
    for (const token of [undefined, ada.id, createEditToken().token]) {
      expect(await getEditablePhotos(token)).toEqual([]);
    }
  });

  it("need a soup to belong to", async () => {
    const undecided = await register(null as never);
    expect(await undecided.add()).toEqual({ status: "no-soup" });
    expect(await db.recipePhoto.count()).toBe(0);
  });

  it("are public only while the soup is, at the soup's own address", async () => {
    const { id, editToken, soupId, add, edit } = await register();
    const other = await register(soupNamed("Borscht"));
    const photoId = savedId(await add());
    expect((await serve(soupId, photoId)).status).toBe(200);
    for (const [soup, photo] of [
      [other.soupId, photoId], [id, photoId], [soupId, soupId], [soupId, "00000000-0000-4000-8000-000000000000"],
      [soupId, "minestrone"], ["minestrone", photoId], [soupId, ""],
    ]) {
      expect((await serve(soup, photo)).status).toBe(404);
    }

    // Cancelled, the photos are kept but have no address.
    expect(await cancelGuestRsvp({ status: "idle" }, photoForm({ editToken, confirmCancel: "yes" })))
      .toMatchObject({ status: "cancelled" });
    expect((await serve(soupId, photoId)).status).toBe(404);
    expect(await getPublicRecipe(soupId)).toBeNull();
    expect(await getEditablePhotos(editToken)).toEqual([{ id: photoId, src: null }]);
    expect(await edit({ recipeKind: "photos" })).toMatchObject({ status: "attending" });
    expect((await serve(soupId, photoId)).status).toBe(200);
    expect((await getPublicRecipe(soupId))!.photos).toMatchObject([{ id: photoId }]);
  });

  it("are the whole recipe: a link or text is refused them, and replaces them", async () => {
    const link = { recipeKind: "link", recipeUrl: "https://example.com/minestrone" };
    const text = { recipeKind: "text", recipeText: "Simmer." };
    for (const other of [link, text]) {
      const { soupId, add, edit } = await register();
      const photoId = savedId(await add());

      // Saved as another kind, the recipe is that kind alone.
      expect(await edit(other)).toMatchObject({ status: "attending" });
      expect(await db.recipePhoto.count()).toBe(0);
      expect((await serve(soupId, photoId)).status).toBe(404);
      expect((await getPublicRecipe(soupId))!.photos).toEqual([]);
      vi.clearAllMocks();
      expect(await add()).toEqual({ status: "other-recipe" });
      expect(await db.recipePhoto.count()).toBe(0);
      expect(updateTag).not.toHaveBeenCalled();

      // Saved as photos, it loses the link or the text, and has room for them.
      expect(await edit({ ...other, recipeKind: "photos" })).toMatchObject({
        status: "attending", soup: { recipeUrl: null, recipeText: null },
      });
      expect(await add()).toMatchObject({ status: "saved" });
      expect(await getPublicRecipe(soupId)).toMatchObject({ recipeUrl: null, recipeText: null, photos: [{}] });
      await clearRsvps();
    }
  });

  it("are removed when the recipe is saved as none", async () => {
    const { soupId, add, edit } = await register();
    await add();
    const nones: Record<string, string>[] = [{ recipeKind: "none" }, {}];
    for (const none of nones) {
      expect(await edit(none)).toMatchObject({ status: "attending" });
      expect(await db.recipePhoto.count()).toBe(0);
      expect(await getPublicRecipe(soupId)).toBeNull();
      expect(await add()).toMatchObject({ status: "saved" });
    }
  });

  it("survive the response's other edits, and go with the soup or the RSVP", async () => {
    const { id, soupId, add, edit } = await register();
    const photoId = savedId(await add());

    // A save sends no photos, and leaves them be while they are the recipe.
    expect(await edit({ name: "Ada Byron", soupName: "Ribollita", recipeKind: "photos" }))
      .toMatchObject({ status: "attending" });
    expect(await getPublicRecipe(soupId)).toMatchObject({ name: "Ribollita", photos: [{ id: photoId }] });

    // A soup with no name is no soup, so its photos go with it.
    expect(await edit({ soupName: "" })).toMatchObject({ status: "attending", soup: null });
    expect(await db.recipePhoto.count()).toBe(0);
    expect((await serve(soupId, photoId)).status).toBe(404);

    const again = await register(soupNamed("Borscht"));
    await again.add();
    await db.rsvp.delete({ where: { id: again.id } });
    await db.rsvp.delete({ where: { id } });
    expect(await db.recipePhoto.count()).toBe(0);
  });

  it("spend a budget of their own, and are refused beyond it", async () => {
    vi.stubEnv("VERCEL", "1");
    const { add, remove, edit } = await register();
    const photoId = savedId(await add());
    // Responses that have used theirs up do not stop a photo, nor photos a response.
    await Promise.all(Array.from({ length: RSVP_RATE_LIMIT }, () => consumeRsvpAttempt("ip:192.0.2.1")));
    expect(await edit()).toMatchObject({ status: "rate-limited" });
    expect(await add()).toMatchObject({ status: "saved" });
    await db.rsvpRateLimit.deleteMany();

    await Promise.all(Array.from({ length: RECIPE_PHOTO_RATE_LIMIT }, () => consumeRecipePhotoAttempt("ip:192.0.2.1")));
    expect(await add()).toEqual({ status: "rate-limited" });
    expect(await remove(photoId)).toEqual({ status: "rate-limited" });
    expect(await db.recipePhoto.count()).toBe(2);
    expect(await edit()).toMatchObject({ status: "attending" });
  });

  it("report an unavailable database without changing anything", async () => {
    const { soupId, add, remove } = await register();
    const photoId = savedId(await add());
    vi.stubEnv("DATABASE_URL", "");
    expect(await add()).toEqual({ status: "failed" });
    expect(await remove(photoId)).toEqual({ status: "failed" });
    expect((await serve(soupId, photoId)).status).toBe(404);
  });
});

describe("recipe photo storage", () => {
  const photo = { bytes: testJpeg(), width: 400, height: 300 };

  it("holds a soup to three places, each used once", async () => {
    const { soupId } = await register();
    const at = (position: number) => db.recipePhoto.create({ data: { ...photo, soupId, position } });
    await at(0);
    await expect(at(0)).rejects.toThrow("recipe_photos_soup_id_position_key");
    for (const position of [-1, 3]) {
      await expect(at(position)).rejects.toThrow("recipe_photos_position_check");
    }
  });

  it("rejects a photo with no bytes, too many, or an impossible size", async () => {
    const { soupId } = await register();
    const store = (data: Partial<typeof photo>) =>
      db.recipePhoto.create({ data: { ...photo, ...data, soupId, position: 0 } });
    for (const bytes of [new Uint8Array(), new Uint8Array(RECIPE_PHOTO_MAX_BYTES + 1)]) {
      await expect(store({ bytes })).rejects.toThrow("recipe_photos_bytes_check");
    }
    for (const size of [{ width: 0 }, { height: 0 }, { width: 1601 }, { height: 1601 }]) {
      await expect(store(size)).rejects.toThrow("recipe_photos_size_check");
    }
  });

  it("cannot exist without a soup", async () => {
    await expect(
      db.recipePhoto.create({ data: { ...photo, soupId: "00000000-0000-4000-8000-000000000000", position: 0 } }),
    ).rejects.toThrow("recipe_photos_soup_id_fkey");
  });
});
