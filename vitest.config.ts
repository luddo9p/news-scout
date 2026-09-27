import { defineConfig } from "vitest/config";

export default defineConfig({
  // No CSS in this Node-only test suite: an inline empty PostCSS config stops Vite
  // from searching parent directories and loading an unrelated postcss.config.js.
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: "node",
  },
});
