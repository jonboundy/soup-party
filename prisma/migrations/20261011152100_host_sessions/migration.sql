-- CreateTable
CREATE TABLE "host_sessions" (
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "host_sessions_pkey" PRIMARY KEY ("token_hash")
);

-- CreateIndex
CREATE INDEX "host_sessions_expires_at_idx" ON "host_sessions"("expires_at");
