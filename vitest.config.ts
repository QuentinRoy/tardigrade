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
					include: [
						"src/**/*.{test,spec}.{ts,tsx,js,jsx}",
						"app/**/*.{test,spec}.{ts,tsx}",
					],
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
				// Pre-bundle deps the browser would otherwise discover mid-run,
				// which forces a Vite reload that fails whichever test was
				// executing. `immer` comes from useAssessmentSession; the rest
				// come from SubmissionQuickJumpDialog (rendered by
				// SubmissionAssessmentClient.stories) and are not reached by any
				// other story. This is a known addon-vitest limitation, not
				// specific to us — see
				// https://github.com/storybookjs/storybook/issues/33067 and
				// https://github.com/vitest-dev/vitest/issues/8447. Remove these
				// once addon-vitest pre-bundles deps reachable from the story
				// graph itself.
				optimizeDeps: {
					include: [
						"immer",
						"fuse.js",
						"@mui/material/Chip",
						"@mui/material/CircularProgress",
						"@mui/material/Dialog",
						"@mui/material/DialogContent",
						"@mui/material/DialogTitle",
					],
				},
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
