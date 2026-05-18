import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const integrationTestFiles = [
  "src/db/assessments.test.ts",
  "src/import/saveAssessments.test.ts",
  "src/import/saveQuestions.test.ts",
  "src/import/saveStudents.test.ts",
  "src/db/migrations.test.ts",
];

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
          exclude: integrationTestFiles,
        },
      },
      {
        test: {
          name: "integration",
          environment: "node",
          include: integrationTestFiles,
          fileParallelism: false,
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
