import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./account-tests",
  fullyParallel: true,
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:5174", headless: true },
  webServer: {
    command: "npm run dev -- --port 5174 --strictPort",
    url: "http://127.0.0.1:5174",
    reuseExistingServer: false,
    env: {
      VITE_SUPABASE_URL: "https://yalla-test.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test_browser_only",
    },
  },
});
