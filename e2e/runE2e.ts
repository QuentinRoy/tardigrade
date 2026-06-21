import { spawn } from "node:child_process";
import {
	provisionEphemeralPostgres,
	teardownEphemeralPostgres,
} from "./ephemeralPostgres.ts";

// Owns the ephemeral Postgres lifecycle for local E2E runs, so the production
// server (started by `playwright.config.ts`'s `webServer`) is always stopped
// before its database disappears underneath it. `playwright.config.ts` itself
// only ever migrates a `TEST_DATABASE_URL` it is handed — provisioning and
// teardown of an ephemeral database live here instead, so the order is always
// "stop the server, then stop the database."
//
// CI's `e2e` job sets `TEST_DATABASE_URL` to its own long-lived service
// container before invoking this script (see `.github/workflows/ci.yml`), so
// this script provisions and tears down nothing in that case — it forwards
// straight to Playwright.

function runPlaywright(env: NodeJS.ProcessEnv): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn("playwright", ["test", ...process.argv.slice(2)], {
			stdio: "inherit",
			env,
		});
		child.on("error", reject);
		child.on("exit", (code) => resolve(code ?? 1));
	});
}

async function runWithEphemeralPostgres(): Promise<number> {
	const handle = await provisionEphemeralPostgres();

	let tornDown = false;
	async function teardown(): Promise<void> {
		if (tornDown) {
			return;
		}
		tornDown = true;
		await teardownEphemeralPostgres(handle);
	}

	// A Ctrl-C or kill during the Playwright run must still stop the ephemeral
	// database, otherwise the container leaks (it has no other owner).
	const handleSignal = (signal: NodeJS.Signals) => {
		void teardown().then(() => process.exit(signal === "SIGINT" ? 130 : 143));
	};
	process.on("SIGINT", handleSignal);
	process.on("SIGTERM", handleSignal);

	try {
		return await runPlaywright({
			...process.env,
			TEST_DATABASE_URL: handle.databaseUrl,
		});
	} finally {
		await teardown();
	}
}

const explicitUrl = process.env["TEST_DATABASE_URL"];
const exitCode =
	explicitUrl != null && explicitUrl !== ""
		? await runPlaywright(process.env)
		: await runWithEphemeralPostgres();

process.exit(exitCode);
