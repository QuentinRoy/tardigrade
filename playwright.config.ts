import { defineConfig, devices } from "@playwright/test";
import {
	migrateToLatest,
	provisionEphemeralPostgres,
} from "./e2e/ephemeralPostgres.ts";

// Standalone Playwright runner for the end-to-end grading smoke test. It is
// separate from the Storybook Vitest browser project: this suite drives the
// real Next.js production server against a real Postgres. See
// `docs/reference/testing-conventions.md`.

const isCi = process.env["CI"] != null && process.env["CI"] !== "";

// Dedicated port, not the dev server's 3000. With `reuseExistingServer` enabled
// locally, sharing 3000 would let Playwright reuse a running `next dev` — which
// is wired to the development database — for the E2E run. A separate port means
// only a server this suite started is ever reused.
const port = 3100;
const baseURL = `http://127.0.0.1:${port}`;

// DB safety — the highest-stakes property of this suite, resolved here rather
// than in a `globalSetup` file.
//
// Playwright's runner starts `webServer` as a "plugin setup" task, and that
// task runs BEFORE any `globalSetup` file (see `createGlobalSetupTasks` in
// `playwright`'s runner: plugin setup tasks are listed ahead of global setup
// tasks). So a `globalSetup` file that mutates `process.env.DATABASE_URL` is
// already too late — by the time it runs, `webServer` has been spawned against
// whatever `DATABASE_URL` `.env.development` provided, which is a developer's
// real database. This file resolves the test database at config-evaluation
// time (top-level `await`, since this is an ESM module) and passes it directly
// through `webServer.env`, so the production server is started with the right
// connection string from the very first instant.
//
// `TEST_DATABASE_URL` is used verbatim if set (CI's `e2e` job supplies its own
// service container). Otherwise this provisions an ephemeral Docker Postgres,
// the same pattern as `src/test/integrationGlobalSetup.ts`; the corresponding
// teardown lives in `e2e/globalTeardown.ts`, which still runs as a normal
// `globalTeardown` file (only the webServer's *startup* ordering is the
// problem, not teardown).
async function resolveTestDatabaseUrl(): Promise<string> {
	const explicitUrl = process.env["TEST_DATABASE_URL"];
	if (explicitUrl != null && explicitUrl !== "") {
		await migrateToLatest(explicitUrl);
		return explicitUrl;
	}

	const {
		composeProject,
		port: postgresPort,
		databaseUrl,
	} = await provisionEphemeralPostgres();
	// Consumed by `globalTeardown.ts`, which runs in this same process.
	process.env["E2E_TEARDOWN_COMPOSE_PROJECT"] = composeProject;
	process.env["E2E_TEARDOWN_POSTGRES_PORT"] = String(postgresPort);
	await migrateToLatest(databaseUrl);
	return databaseUrl;
}

const databaseUrl = await resolveTestDatabaseUrl();

export default defineConfig({
	testDir: "e2e",
	// A single, strictly sequential happy-path smoke test.
	fullyParallel: false,
	workers: 1,
	forbidOnly: isCi,
	retries: isCi ? 2 : 0,
	reporter: isCi ? [["list"], ["html", { open: "never" }]] : "list",
	globalTeardown: "./e2e/globalTeardown.ts",
	use: { baseURL, trace: "on-first-retry", video: "retain-on-failure" },
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		// Production server. `next dev` short-circuits the Next.js caches, so it
		// would not exercise the cache-invalidation paths this test exists to
		// prove. A build must already exist (`pnpm build`); CI builds first.
		// `DATABASE_URL` here is the resolved test database; dotenvx
		// (`--convention=flow`) keeps an env var pre-set on the spawning process
		// over the value in `.env.development`.
		command: "pnpm start",
		url: baseURL,
		env: { PORT: String(port), DATABASE_URL: databaseUrl },
		reuseExistingServer: !isCi,
		timeout: 120_000,
		stdout: "pipe",
		stderr: "pipe",
	},
});
