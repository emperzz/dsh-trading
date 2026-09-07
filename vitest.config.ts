import { defineConfig } from "vitest/config";

export default defineConfig({
  // The packages compile with the automatic JSX runtime (react-jsx); without
  // this vitest's esbuild falls back to the classic transform and .tsx
  // sources blow up on an unimported `React`.
  esbuild: { jsx: "automatic" },
  test: {
    include: ["packages/*/test/**/*.test.ts"],
    environment: "node",
  },
});
