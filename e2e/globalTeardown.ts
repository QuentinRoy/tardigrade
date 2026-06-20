import { teardownEphemeralPostgres } from "./ephemeralPostgres.ts";

// Tears down the ephemeral Postgres provisioned in `playwright.config.ts`
// (see the comment there on why provisioning happens at config-evaluation
// time rather than in a `globalSetup` file). When the suite ran against an
// external `TEST_DATABASE_URL` (CI), no container was created and the
// teardown variables are absent, so this is a no-op.
//
// Playwright runs this before stopping the `webServer` it started (global
// teardown unwinds before plugin teardown), so the production server is still
// connected when the container goes away. That logs a burst of "terminating
// connection due to administrator command" from the app's own pg pool before
// Playwright kills the process — harmless here since the test run has already
// concluded, but it is the same symptom as a real backend-initiated disconnect
// in production (see the follow-up on `src/db/kysely.ts`'s pool error handling).

export default async function globalTeardown(): Promise<void> {
	const composeProject = process.env["E2E_TEARDOWN_COMPOSE_PROJECT"];
	if (composeProject == null || composeProject === "") {
		return;
	}

	const rawPort = process.env["E2E_TEARDOWN_POSTGRES_PORT"];
	const port = Number(rawPort);
	if (rawPort == null || rawPort === "" || !Number.isInteger(port)) {
		// A compose project without a valid port means `playwright.config.ts`
		// set one teardown variable but not the other — a setup bug, not a
		// teardown-time error. Fail loudly rather than passing "NaN" to
		// `docker compose`, which would leave the container running.
		throw new Error(
			`E2E_TEARDOWN_POSTGRES_PORT must be an integer when E2E_TEARDOWN_COMPOSE_PROJECT is set; got ${JSON.stringify(rawPort)}.`,
		);
	}

	await teardownEphemeralPostgres({ composeProject, port });
}
