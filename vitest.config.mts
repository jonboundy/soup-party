import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      // Next.js resolves this marker itself; outside Next.js it is a no-op.
      "server-only": fileURLToPath(new URL("./tests/server-only.ts", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globalSetup: "./tests/global-setup.ts",
    // Database tests share one database, so files run one at a time.
    fileParallelism: false,
  },
});
