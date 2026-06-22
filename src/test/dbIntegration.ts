import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";
import Cursor from "pg-cursor";
import type { DB } from "#db/generated/db.ts";

export type DisposableTestDatabase = Kysely<DB> & {
	[Symbol.asyncDispose](): Promise<void>;
};

const POSTGRES_IMAGE = "postgres:17-alpine";

// Each test owns one container, so it needs only a single connection at a time;
// this just bounds how many connections a test can pile up if it leaks one.
const TEST_DB_POOL_MAX = 5;

// Postgres reports these SQLSTATE codes when it terminates a client connection
// as part of its own shutdown. Stopping a per-test container disconnects any
// client still flushing its graceful `pool.end()`. Node's EventEmitter throws
// on an 'error' event with no listener, which would otherwise crash the worker
// even though the test itself already passed.
const POSTGRES_SHUTDOWN_ERROR_CODES = new Set([
	"57P01", // admin_shutdown
	"57P02", // crash_shutdown
	"57P03", // cannot_connect_now
]);

export function isPostgresShutdownError(error: unknown): boolean {
	if (typeof error !== "object" || error === null || !("code" in error)) {
		return false;
	}

	return (
		typeof error.code === "string" &&
		POSTGRES_SHUTDOWN_ERROR_CODES.has(error.code)
	);
}

function createTestPool(connectionString: string): Pool {
	const pool = new Pool({ connectionString, max: TEST_DB_POOL_MAX });

	// Stopping the per-test container is a backend-initiated disconnect that
	// node-postgres reports as an 'error' event, and an unhandled 'error' event
	// crashes the worker even though the test already passed. The event lands on
	// a different channel depending on the connection's state, so both the pool
	// and each client must carry a listener (see
	// https://github.com/brianc/node-postgres/issues/1986). Swallow the expected
	// shutdown SQLSTATEs on both; anything a test depends on still surfaces
	// through that operation's own rejected promise.
	const ignoreShutdownDisconnect = (error: unknown): void => {
		if (isPostgresShutdownError(error)) {
			return;
		}
	};

	pool.on("error", ignoreShutdownDisconnect);
	pool.on("connect", (client) => {
		client.on("error", ignoreShutdownDisconnect);
	});

	return pool;
}

export function buildTestId(prefix: string): string {
	return `${prefix}-${randomUUID()}`;
}

export const testMigrationsPath = path.join(
	path.dirname(fileURLToPath(import.meta.url)),
	"../db/migrations",
);

export function createMigrator(
	dbInstance: Kysely<DB>,
	migrationFolder: string,
): Migrator {
	return new Migrator({
		db: dbInstance,
		provider: new FileMigrationProvider({ fs, path, migrationFolder }),
	});
}

// Starts a dedicated Postgres container for a single test, migrates it to the
// latest schema, and returns a disposable Kysely handle that stops the
// container when the test's scope exits. Each test is therefore fully isolated
// by its own database server.
export async function createTestDb(): Promise<DisposableTestDatabase> {
	const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();

	const db = new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: createTestPool(container.getConnectionUri()),
			cursor: Cursor,
		}),
		plugins: [new CamelCasePlugin()],
	});

	const { error } = await createMigrator(
		db,
		testMigrationsPath,
	).migrateToLatest();

	if (error != null) {
		await db.destroy();
		await container.stop();
		throw error;
	}

	return Object.assign(db, {
		async [Symbol.asyncDispose](): Promise<void> {
			await db.destroy();
			await container.stop();
		},
	});
}
