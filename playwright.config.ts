import { defineConfig, devices } from "@playwright/test";
import { migrateToLatest } from "./e2e/ephemeralPostgres.ts";

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
// `TEST_DATABASE_URL` must already be set by the caller: CI's `e2e` job points
// it at its own long-lived service container, and `pnpm test:e2e` runs
// `e2e/runE2e.ts`, which provisions an ephemeral Postgres and sets it before
// invoking Playwright. Provisioning and teardown of that ephemeral database
// intentionally live outside this config, in a process that outlives
// `webServer` — so the database is only ever torn down *after* Playwright has
// stopped the production server, never while it is still connected.
async function resolveTestDatabaseUrl(): Promise<string> {
	const explicitUrl = process.env["TEST_DATABASE_URL"];
	if (explicitUrl == null || explicitUrl === "") {
		throw new Error(
			"TEST_DATABASE_URL is required to run this suite. Use `pnpm test:e2e`, which sets it via e2e/runE2e.ts.",
		);
	}
	await migrateToLatest(explicitUrl);
	return explicitUrl;
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
