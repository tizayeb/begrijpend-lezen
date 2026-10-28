import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: {
      DATABASE_URL: `file:${path.resolve(__dirname, "tests/test.db")}`,
    },
  },
});
