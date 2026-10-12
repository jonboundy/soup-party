-- AlterTable
ALTER TABLE "soups" ADD COLUMN     "recipe_text" TEXT,
ADD COLUMN     "recipe_url" TEXT;

-- The rest of this file is written by hand: Prisma cannot express CHECK constraints.

-- The link is rendered as an href, so it has to be a web address.
ALTER TABLE "soups" ADD CONSTRAINT "soups_recipe_url_check" CHECK ("recipe_url" IS NULL OR "recipe_url" ~* '^https?://\S+$');

ALTER TABLE "soups" ADD CONSTRAINT "soups_recipe_text_check" CHECK ("recipe_text" IS NULL OR btrim("recipe_text") <> '');
