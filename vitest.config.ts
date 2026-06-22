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
					// Each project below sets its own `maxWorkers`. Vitest requires
					// projects with different `maxWorkers` to run in different sequence
					// groups (lower groups run before higher ones) when run together, since
					// a single worker pool can't enforce two different concurrency limits
					// at once. CI never runs the combined `pnpm test` script (each project
					// has its own job), so this ordering only affects local full runs.
					sequence: { groupOrder: 0 },
				},
			},
			{
				test: {
					name: "integration",
					environment: "node",
					include: [integrationPattern],
					// Files run in parallel across workers. Each test starts its own
					// throwaway Postgres container (see createTestDb in
					// dbIntegration.ts), so isolation holds without
					// `fileParallelism: false`. Capped so the number of Postgres
					// containers running concurrently stays modest.
					maxWorkers: 4,
					alias: nodeTestAlias,
					sequence: { groupOrder: 1 },
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
					sequence: { groupOrder: 2 },
				},
			},
		],
	},
});
