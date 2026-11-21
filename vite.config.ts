import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "/openWorld/",
  plugins: [react()],
  // Тесты игры лежат в src/. Серверный прокси тестируется отдельно: cd server && npm test.
  test: { include: ["src/**/*.test.ts"] }
});
