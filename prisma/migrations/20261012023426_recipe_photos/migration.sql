-- CreateTable
CREATE TABLE "recipe_photos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "soup_id" UUID NOT NULL,
    "position" SMALLINT NOT NULL,
    "bytes" BYTEA NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "recipe_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "recipe_photos_soup_id_position_key" ON "recipe_photos"("soup_id", "position");

-- AddForeignKey
ALTER TABLE "recipe_photos" ADD CONSTRAINT "recipe_photos_soup_id_fkey" FOREIGN KEY ("soup_id") REFERENCES "soups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- The rest of this file is written by hand: Prisma cannot express CHECK constraints.

-- With the unique index on (soup_id, position), this holds a soup to three photos.
ALTER TABLE "recipe_photos" ADD CONSTRAINT "recipe_photos_position_check" CHECK ("position" BETWEEN 0 AND 2);

-- Backstops for the limits in src/lib/recipe-photo.ts, which the upload enforces first.
ALTER TABLE "recipe_photos" ADD CONSTRAINT "recipe_photos_bytes_check" CHECK (octet_length("bytes") BETWEEN 1 AND 600000);

ALTER TABLE "recipe_photos" ADD CONSTRAINT "recipe_photos_size_check" CHECK ("width" BETWEEN 1 AND 1600 AND "height" BETWEEN 1 AND 1600);
