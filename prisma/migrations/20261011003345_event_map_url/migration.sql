-- AlterTable
ALTER TABLE "events" ADD COLUMN     "map_url" TEXT;

-- The rest of this file is written by hand: Prisma cannot express CHECK constraints.

-- The link is rendered as an href, so it has to be a web address.
ALTER TABLE "events" ADD CONSTRAINT "events_map_url_check" CHECK ("map_url" IS NULL OR "map_url" ~* '^https?://\S+$');
