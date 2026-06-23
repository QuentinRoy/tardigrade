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
					// Files run in parallel across workers. Each test gets its own
					// database (cloned from a template built once in global setup,
					// see integrationGlobalSetup.ts), so isolation holds without
					// `fileParallelism: false`. Capped so concurrent per-test
					// connection pools (see TEST_DB_POOL_MAX in dbIntegration.ts)
					// stay well under Postgres's default max_connections.
					maxWorkers: 6,
					globalSetup: ["src/test/integrationGlobalSetup.ts"],
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
				// Pre-bundle immer so the browser doesn't discover it mid-run and
				// force a Vite reload, which fails whichever test was executing
				// (see useAssessmentSession.stories.tsx, the first story to exercise
				// the immer-importing useAssessmentSession hook). This is a known
				// addon-vitest limitation, not something specific to us — see
				// https://github.com/storybookjs/storybook/issues/33067 and
				// https://github.com/vitest-dev/vitest/issues/8447. Remove this once
				// addon-vitest pre-bundles deps reachable from the story graph itself.
				optimizeDeps: { include: ["immer"] },
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
