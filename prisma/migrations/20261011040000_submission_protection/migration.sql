ALTER TABLE "rsvps" ADD COLUMN "submission_hash" TEXT;

CREATE TABLE "rsvp_rate_limits" (
  "key" TEXT PRIMARY KEY,
  "window_start" TIMESTAMPTZ(3) NOT NULL,
  "attempts" INTEGER NOT NULL CHECK ("attempts" > 0)
);
CREATE INDEX "rsvp_rate_limits_window_start_idx" ON "rsvp_rate_limits" ("window_start");
