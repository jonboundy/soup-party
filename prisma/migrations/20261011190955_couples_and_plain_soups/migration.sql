-- AlterTable
ALTER TABLE "rsvps" ADD COLUMN     "second_name" TEXT;

-- AlterTable
ALTER TABLE "soups" DROP COLUMN "category",
DROP COLUMN "description";

-- DropEnum
DROP TYPE "soup_category";

-- The rest of this file is written by hand: Prisma cannot express CHECK constraints.

ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_second_name_check" CHECK ("second_name" IS NULL OR btrim("second_name") <> '');

-- A party is now the guests named: one, or two with a second name. No RSVP
-- has a second name yet, so every attending party becomes one.
UPDATE "rsvps" SET "party_size" = 1 WHERE "status" = 'ATTENDING';

ALTER TABLE "rsvps" DROP CONSTRAINT "rsvps_party_size_check";

ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_party_size_check" CHECK (
    ("status" = 'ATTENDING' AND "party_size" IS NOT NULL
        AND "party_size" = CASE WHEN "second_name" IS NULL THEN 1 ELSE 2 END)
    OR ("status" = 'DECLINED' AND "party_size" IS NULL)
);
