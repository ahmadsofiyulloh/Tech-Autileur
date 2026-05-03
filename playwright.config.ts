import { defineConfig } from "@playwright/test";
import nextEnv from "@next/env";
import path from "node:path";

const { loadEnvConfig } = nextEnv as typeof import("@next/env");
loadEnvConfig(process.cwd());

const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3000";
const authStatePath = path.join(process.cwd(), ".playwright", ".auth", "smoke.json");

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  timeout: 180_000,
  expect: {
    timeout: 15_000,
  },
  reporter: [
    ["list"],
    [
      "html",
      {
        open: "never",
        outputFolder: "playwright-report",
      },
    ],
  ],
  globalSetup: "./tests/e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "smoke",
      dependencies: ["setup"],
      use: {
        storageState: authStatePath,
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
