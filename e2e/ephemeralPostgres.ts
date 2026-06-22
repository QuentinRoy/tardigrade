import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";

// Self-contained ephemeral Postgres for the E2E suite: a throwaway Docker
// Compose project on a free port, torn down with `down -v`. It is never a
// developer's database.

const HOST = "127.0.0.1";
const POSTGRES_USER = "postgres";
const POSTGRES_PASSWORD = "postgres";
const POSTGRES_DB = "postgres";

export type EphemeralPostgresHandle = { composeProject: string; port: number };

function run(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { env, stdio: "inherit" });
		child.on("error", reject);
		child.on("exit", (code) => resolve(code ?? 1));
	});
}

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();
		server.on("error", reject);
		server.listen(0, HOST, () => {
			const address = server.address();
			if (address == null || typeof address === "string") {
				reject(new Error("Unable to determine a free port"));
				return;
			}
			const { port } = address;
			server.close((error) => {
				if (error != null) {
					reject(error);
					return;
				}
				resolve(port);
			});
		});
	});
}

async function waitForQueryReady(connectionString: string): Promise<void> {
	const maxAttempts = 60;
	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const pool = new Pool({ connectionString });
		try {
			await pool.query("select 1");
			return;
		} catch {
			await delay(1000);
		} finally {
			await pool.end();
		}
	}
	throw new Error("Postgres did not become query-ready in time");
}

function composeEnv(port: number): NodeJS.ProcessEnv {
	return {
		...process.env,
		POSTGRES_USER,
		POSTGRES_PASSWORD,
		POSTGRES_DB,
		POSTGRES_PORT: String(port),
	};
}

function databaseUrlFor(port: number): string {
	return `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${HOST}:${port}/${POSTGRES_DB}`;
}

export async function provisionEphemeralPostgres(): Promise<
	EphemeralPostgresHandle & { databaseUrl: string }
> {
	const port = await getFreePort();
	const composeProject = `grading_e2e_${randomUUID().replaceAll("-", "")}`;
	const env = composeEnv(port);

	const upCode = await run(
		"docker",
		["compose", "-p", composeProject, "up", "-d", "postgres"],
		env,
	);
	if (upCode !== 0) {
		await teardownEphemeralPostgres({ composeProject, port });
		throw new Error(
			"Docker Compose failed to start the E2E Postgres container.",
		);
	}

	const databaseUrl = databaseUrlFor(port);
	try {
		await waitForQueryReady(databaseUrl);
	} catch (error) {
		await teardownEphemeralPostgres({ composeProject, port });
		throw error;
	}

	return { composeProject, port, databaseUrl };
}

export async function teardownEphemeralPostgres({
	composeProject,
	port,
}: EphemeralPostgresHandle): Promise<void> {
	await run(
		"docker",
		["compose", "-p", composeProject, "down", "-v", "--remove-orphans"],
		composeEnv(port),
	);
}

export async function migrateToLatest(databaseUrl: string): Promise<void> {
	const code = await run("node", ["src/db/migrate.ts", "up"], {
		...process.env,
		DATABASE_URL: databaseUrl,
	});
	if (code !== 0) {
		throw new Error("Database migrations failed for the E2E database.");
	}
}
