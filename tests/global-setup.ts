import "dotenv/config";

import { execFileSync } from "node:child_process";

// Tests run against a separate database, named after the development one with
// a `_test` suffix, so they can delete rows freely. `prisma migrate deploy`
// creates it on first use and applies any pending migrations.
export default function setup() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.");
  }

  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}_test`;
  process.env.DATABASE_URL = url.href;

  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: process.env,
    stdio: "pipe",
  });
}
