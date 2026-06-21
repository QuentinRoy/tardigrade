import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import net from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import {
	buildTestTemplate,
	dropTestTemplate,
	isPostgresShutdownError,
	TEST_TEMPLATE_DB_NAME_ENV_VAR,
	testMigrationsPath,
} from "./dbIntegration.ts";

type RunResult = { code: number };

const DEFAULT_POSTGRES_USER = "postgres";
const DEFAULT_POSTGRES_PASSWORD = "postgres";
const DEFAULT_POSTGRES_DB = "postgres";
const DEFAULT_HOST = "127.0.0.1";
const TEARDOWN_STOP_TIMEOUT_SECONDS = "10";

function run(
	command: string,
	args: string[],
	env: NodeJS.ProcessEnv,
): Promise<RunResult> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { env, stdio: "inherit" });

		child.on("error", reject);
		child.on("exit", (code) => {
			resolve({ code: code ?? 1 });
		});
	});
}

function getFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = net.createServer();

		server.on("error", reject);
		server.listen(0, DEFAULT_HOST, () => {
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

async function waitForTcpReady(host: string, port: number): Promise<void> {
	const maxAttempts = 60;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		const connected = await new Promise<boolean>((resolve) => {
			const socket = net.createConnection({ host, port });

			socket.once("connect", () => {
				socket.end();
				resolve(true);
			});

			socket.once("error", () => {
				resolve(false);
			});
		});

		if (connected) {
			return;
		}

		await delay(1000);
	}

	throw new Error(`Postgres did not become reachable on ${host}:${port}`);
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

async function stopAndRemoveContainers(
	composeProject: string,
	composeEnv: NodeJS.ProcessEnv,
): Promise<void> {
	const onUncaughtException = (error: unknown): void => {
		if (isPostgresShutdownError(error)) {
			return;
		}

		process.removeListener("uncaughtException", onUncaughtException);
		throw error;
	};

	process.on("uncaughtException", onUncaughtException);

	try {
		await run(
			"docker",
			[
				"compose",
				"-p",
				composeProject,
				"stop",
				"-t",
				TEARDOWN_STOP_TIMEOUT_SECONDS,
			],
			composeEnv,
		);
		await run(
			"docker",
			["compose", "-p", composeProject, "down", "-v", "--remove-orphans"],
			composeEnv,
		);
	} finally {
		process.removeListener("uncaughtException", onUncaughtException);
	}
}

function buildTestDatabaseUrl(params: {
	user: string;
	password: string;
	host: string;
	port: number;
	database: string;
}): string {
	const encodedUser = encodeURIComponent(params.user);
	const encodedPassword = encodeURIComponent(params.password);
	const encodedDatabase = encodeURIComponent(params.database);

	return `postgresql://${encodedUser}:${encodedPassword}@${params.host}:${params.port}/${encodedDatabase}`;
}

async function startDockerPostgres(): Promise<{
	composeProject: string;
	composeEnv: NodeJS.ProcessEnv;
}> {
	const port = await getFreePort();
	const postgresUser = process.env["POSTGRES_USER"] ?? DEFAULT_POSTGRES_USER;
	const postgresPassword =
		process.env["POSTGRES_PASSWORD"] ?? DEFAULT_POSTGRES_PASSWORD;
	const postgresDb = process.env["POSTGRES_DB"] ?? DEFAULT_POSTGRES_DB;
	const composeProject = `grading_it_${randomUUID().replaceAll("-", "")}`;

	const composeEnv: NodeJS.ProcessEnv = {
		...process.env,
		POSTGRES_USER: postgresUser,
		POSTGRES_PASSWORD: postgresPassword,
		POSTGRES_DB: postgresDb,
		POSTGRES_PORT: String(port),
	};

	const testDbUrl = buildTestDatabaseUrl({
		user: postgresUser,
		password: postgresPassword,
		host: DEFAULT_HOST,
		port,
		database: postgresDb,
	});

	let upSucceeded = false;

	try {
		const up = await run(
			"docker",
			["compose", "-p", composeProject, "up", "-d", "postgres"],
			composeEnv,
		);

		if (up.code !== 0) {
			throw new Error("Docker Compose failed to start Postgres");
		}

		upSucceeded = true;
		await waitForTcpReady(DEFAULT_HOST, port);
		await waitForQueryReady(testDbUrl);
		process.env["TEST_DATABASE_URL"] = testDbUrl;
	} catch (error) {
		if (upSucceeded) {
			await run(
				"docker",
				["compose", "-p", composeProject, "down", "-v", "--remove-orphans"],
				composeEnv,
			);
		}

		throw error;
	}

	return { composeProject, composeEnv };
}

export default async function integrationGlobalSetup(): Promise<
	void | (() => Promise<void>)
> {
	const hasExternalDatabase =
		process.env["TEST_DATABASE_URL"] != null &&
		process.env["TEST_DATABASE_URL"] !== "";

	const docker = hasExternalDatabase ? null : await startDockerPostgres();

	// Run once here, before any test file starts, so migrations only run once
	// even though integration test files now run in parallel across workers
	// (see vitest.config.ts). Each test then clones this template instead of
	// migrating from scratch.
	let templateDbName: string;

	try {
		templateDbName = await buildTestTemplate(testMigrationsPath);
	} catch (error) {
		if (docker != null) {
			await stopAndRemoveContainers(docker.composeProject, docker.composeEnv);
		}

		throw error;
	}

	process.env[TEST_TEMPLATE_DB_NAME_ENV_VAR] = templateDbName;

	return async () => {
		await dropTestTemplate(templateDbName);

		if (docker != null) {
			await stopAndRemoveContainers(docker.composeProject, docker.composeEnv);
		}
	};
}
