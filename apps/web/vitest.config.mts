import { defineConfig } from "vitest/config";

/**
 * Setup Vitest untuk Next.js 16 (docs: node_modules/next/dist/docs/01-app/02-guides/testing/vitest.md).
 *
 * `environment: "node"` — unit test pure TypeScript (scoring, kontrak).
 * Task 6 (test komponen React) akan butuh `jsdom` + `@vitejs/plugin-react`;
 * lihat catatan di TASKS.md soal konflik peer-dependency dengan CLI `shadcn`.
 */
export default defineConfig({
  // Vite mendukung resolusi tsconfig paths secara native sejak v6.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
