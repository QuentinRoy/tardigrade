import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const integrationPattern = "src/**/*.integration.test.{ts,tsx}";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
          exclude: [integrationPattern],
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: [integrationPattern],
          fileParallelism: false,
          globalSetup: ["src/test/integrationGlobalSetup.ts"],
        },
      },
      {
        plugins: [
          storybookTest({
            configDir: ".storybook",
            storybookUrl: "http://localhost:6006",
          }),
        ],
        test: {
          name: "storybook",
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
