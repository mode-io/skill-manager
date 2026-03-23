import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./frontend/e2e",
  timeout: 30000,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "python3 scripts/serve_e2e_fixture.py",
    url: "http://127.0.0.1:4173/health",
    reuseExistingServer: false,
    timeout: 30000,
  },
});
