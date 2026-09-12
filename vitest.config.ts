import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.spec.ts", "apps/**/test/**/*.spec.ts", "tests/**/*.spec.ts"],
    environment: "node",
  },
  resolve: {
    // Map workspace package subpath exports to their TS sources for tests.
    extensions: [".ts", ".js"],
  },
});
