import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

// SWC garde les « décorateurs » de Nest (@Injectable, @Controller…) lors des tests.
export default defineConfig({
  test: { globals: true, include: ["test/**/*.e2e-spec.ts"], testTimeout: 30000, fileParallelism: false, environment: "node", env: { MAX_LESSONS_AHEAD: "50" } },
  plugins: [swc.vite({ module: { type: "es6" } })],
});
