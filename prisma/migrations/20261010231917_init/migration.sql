-- CreateEnum
CREATE TYPE "rsvp_status" AS ENUM ('ATTENDING', 'DECLINED');

-- CreateEnum
CREATE TYPE "soup_category" AS ENUM ('BROTH', 'CREAMY', 'VEGETABLE', 'BEAN', 'NOODLE', 'MEAT', 'SEAFOOD', 'STEW', 'CHILLED', 'OTHER');

-- CreateTable
CREATE TABLE "events" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3),
    "time_zone" TEXT,
    "location_label" TEXT,
    "address" TEXT,
    "instructions" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rsvps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attendee_name" TEXT NOT NULL,
    "status" "rsvp_status" NOT NULL,
    "party_size" INTEGER,
    "edit_token_hash" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rsvps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "soups" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "rsvp_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "normalized_name" TEXT NOT NULL,
    "category" "soup_category" NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "soups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rsvps_edit_token_hash_key" ON "rsvps"("edit_token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "soups_rsvp_id_key" ON "soups"("rsvp_id");

-- CreateIndex
CREATE INDEX "soups_normalized_name_idx" ON "soups"("normalized_name");

-- AddForeignKey
ALTER TABLE "soups" ADD CONSTRAINT "soups_rsvp_id_fkey" FOREIGN KEY ("rsvp_id") REFERENCES "rsvps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The rest of this file is written by hand: Prisma cannot express CHECK constraints.

-- One event row only.
ALTER TABLE "events" ADD CONSTRAINT "events_singleton_check" CHECK ("id" = 1);

-- A start time is only meaningful alongside the zone it is displayed in.
ALTER TABLE "events" ADD CONSTRAINT "events_time_zone_check" CHECK ("starts_at" IS NULL OR "time_zone" IS NOT NULL);

ALTER TABLE "events" ADD CONSTRAINT "events_title_check" CHECK (btrim("title") <> '');

ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_attendee_name_check" CHECK (btrim("attendee_name") <> '');

-- Attending needs a party of at least one; declining has no party.
ALTER TABLE "rsvps" ADD CONSTRAINT "rsvps_party_size_check" CHECK (
    ("status" = 'ATTENDING' AND "party_size" IS NOT NULL AND "party_size" >= 1)
    OR ("status" = 'DECLINED' AND "party_size" IS NULL)
);

ALTER TABLE "soups" ADD CONSTRAINT "soups_name_check" CHECK (btrim("name") <> '');

-- The event row. Date, time zone, location and instructions are filled in once known.
INSERT INTO "events" ("id", "title") VALUES (1, 'Soup Party');
