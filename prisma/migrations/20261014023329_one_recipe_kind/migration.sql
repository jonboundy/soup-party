-- Written by hand: the schema is unchanged, and Prisma cannot express CHECK constraints.

-- A recipe is now one kind of thing: a link, or the recipe written out, or
-- photos of it. One that was more than one keeps the fullest: its text, then
-- its photos, then its link.
DELETE FROM "recipe_photos" USING "soups"
WHERE "recipe_photos"."soup_id" = "soups"."id" AND "soups"."recipe_text" IS NOT NULL;

UPDATE "soups" SET "recipe_url" = NULL
WHERE "recipe_url" IS NOT NULL
  AND ("recipe_text" IS NOT NULL OR EXISTS (SELECT 1 FROM "recipe_photos" WHERE "soup_id" = "soups"."id"));

-- Photos are in a table of their own, out of a CHECK's reach: the writes in
-- src/lib/rsvp.ts and src/lib/recipe-photos.ts keep them apart from these two.
ALTER TABLE "soups" ADD CONSTRAINT "soups_recipe_kind_check" CHECK ("recipe_url" IS NULL OR "recipe_text" IS NULL);
