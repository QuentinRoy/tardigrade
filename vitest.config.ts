import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const integrationPattern = "src/**/*.integration.test.{ts,tsx}";

// Resolve the `server-only` import to an empty module in node tests, so server
// modules import cleanly without each test stubbing it. See
// `docs/reference/testing-conventions.md`.
const nodeTestAlias = {
	"server-only": fileURLToPath(
		new URL("./src/test/serverOnlyStub.ts", import.meta.url),
	),
};

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					environment: "node",
					include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
					exclude: [integrationPattern],
					alias: nodeTestAlias,
				},
			},
			{
				test: {
					name: "integration",
					environment: "node",
					include: [integrationPattern],
					fileParallelism: false,
					globalSetup: ["src/test/integrationGlobalSetup.ts"],
					alias: nodeTestAlias,
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
