import { afterAll, beforeAll, expect, it, vi } from "vitest";

// Preview deployments are built with no database. `next build` loads every
// route to read its configuration, so one that reaches `@/lib/db` through
// static imports fails the build there.
const routes = import.meta.glob("../src/app/**/{page,actions}.{ts,tsx}");

beforeAll(() => {
  vi.stubEnv("DATABASE_URL", "");
  vi.resetModules();
});
afterAll(() => vi.unstubAllEnvs());

it("finds the routes", () => {
  expect(Object.keys(routes)).toContain("../src/app/host/page.tsx");
});

it.each(Object.keys(routes))("%s loads without a database", async (route) => {
  await expect(routes[route]()).resolves.toBeDefined();
});
