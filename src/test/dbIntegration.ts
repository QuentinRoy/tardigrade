import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";
import Cursor from "pg-cursor";
import type { DB } from "#db/generated/db.ts";

export type StartedTestDatabase = {
	db: Kysely<DB>;
	cleanup?: () => Promise<void>;
};

export type DisposableTestDatabase = Kysely<DB> & {
	[Symbol.asyncDispose](): Promise<void>;
};

const TEST_DATABASE_PREFIX = "grading_test_db";
const TEST_TEMPLATE_PREFIX = "grading_test_tpl";
export const TEST_TEMPLATE_DB_NAME_ENV_VAR = "TEST_TEMPLATE_DB_NAME";
// Each test owns a single connection at a time; this just bounds how many
// connections a worker can pile up if a test leaks one, so that running
// several integration test files in parallel (see vitest.config.ts) stays
// well under Postgres's default max_connections.
const TEST_DB_POOL_MAX = 5;
const runTag = sanitizeDbIdentifier(
	process.env["GITHUB_RUN_ID"] ?? `${Date.now()}_${process.pid}`,
);

// Postgres reports these SQLSTATE codes when it terminates a client
// connection as part of its own shutdown: our own dropDatabase() below calls
// pg_terminate_backend on every per-test cleanup, and the Docker-managed
// Postgres container's own shutdown can do the same. Either way, a client can
// still be flushing its graceful `pool.end()` call when this happens. Node's
// EventEmitter throws on an 'error' event with no listener attached, which
// would otherwise crash the worker even though the test itself already
// passed.
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

	// A backend-initiated disconnect happens routinely during teardown: our own
	// dropDatabase() calls pg_terminate_backend on every per-test cleanup, and
	// the Docker-managed Postgres container's own shutdown can do the same.
	// node-postgres reports it as an 'error' event, and an unhandled 'error'
	// event crashes the worker even though the test itself already passed.
	//
	// The event lands on a different channel depending on the connection's
	// state, so both must carry a listener:
	//   - a checked-out client emits on the client itself (listen per client);
	//   - an idle client's error is re-emitted on the *pool* by node-postgres'
	//     internal idle listener (pg-pool makeIdleListener -> pool.emit('error')),
	//     so a per-client listener alone misses it (see
	//     https://github.com/brianc/node-postgres/issues/1986) — listen on the
	//     pool as well.
	//
	// Swallow the expected shutdown SQLSTATEs on both channels. Anything a test
	// actually depends on still surfaces through that operation's own rejected
	// promise, so there is no need to log it again here.
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

function quoteIdentifier(identifier: string): string {
	return `"${identifier.replaceAll('"', '""')}"`;
}

function sanitizeDbIdentifier(value: string): string {
	return value
		.toLowerCase()
		.replaceAll(/[^a-z0-9_]/g, "_")
		.slice(0, 63);
}

function buildDbName(prefix: string): string {
	const suffix = sanitizeDbIdentifier(randomUUID().replaceAll("-", "_"));
	return sanitizeDbIdentifier(`${prefix}_${runTag}_${suffix}`);
}

function buildConnectionString(baseUrl: URL, databaseName: string): string {
	const url = new URL(baseUrl.toString());
	url.pathname = `/${databaseName}`;
	return url.toString();
}

async function createDatabase(
	adminPool: Pool,
	databaseName: string,
): Promise<void> {
	await adminPool.query(`create database ${quoteIdentifier(databaseName)}`);
}

async function createDatabaseFromTemplate(
	adminPool: Pool,
	databaseName: string,
	templateName: string,
): Promise<void> {
	await adminPool.query(
		`create database ${quoteIdentifier(databaseName)} template ${quoteIdentifier(
			templateName,
		)}`,
	);
}

async function dropDatabase(
	adminPool: Pool,
	databaseName: string,
): Promise<void> {
	await adminPool.query(
		"select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()",
		[databaseName],
	);
	await adminPool.query(
		`drop database if exists ${quoteIdentifier(databaseName)}`,
	);
}

function readExternalAdminUrl(): URL {
	const url = process.env["TEST_DATABASE_URL"];

	if (url == null || url.length === 0) {
		throw new Error("TEST_DATABASE_URL must be set for integration tests");
	}

	return new URL(url);
}

function readTemplateDbName(): string {
	const name = process.env[TEST_TEMPLATE_DB_NAME_ENV_VAR];

	if (name == null || name.length === 0) {
		throw new Error(
			`${TEST_TEMPLATE_DB_NAME_ENV_VAR} must be set for integration tests (set by integrationGlobalSetup.ts)`,
		);
	}

	return name;
}

type DisposableAdminPool = {
	pool: Pool;
	[Symbol.asyncDispose](): Promise<void>;
};

function createDisposableAdminPool(
	connectionString: string,
): DisposableAdminPool {
	const pool = createTestPool(connectionString);

	return {
		pool,
		async [Symbol.asyncDispose](): Promise<void> {
			await pool.end();
		},
	};
}

type DisposableMigrationDb = {
	db: Kysely<DB>;
	[Symbol.asyncDispose](): Promise<void>;
};

function createDisposableMigrationDb(
	connectionString: string,
): DisposableMigrationDb {
	// Mirrors the production migration runner (src/db/migrate.ts), which also
	// builds Kysely with CamelCasePlugin, so migrations run identically here.
	const db = new Kysely<DB>({
		dialect: new PostgresDialect({ pool: createTestPool(connectionString) }),
		plugins: [new CamelCasePlugin()],
	});

	return {
		db,
		async [Symbol.asyncDispose](): Promise<void> {
			await db.destroy();
		},
	};
}

async function createTemplateDatabase(
	adminConnectionUrl: URL,
	templateDbName: string,
): Promise<void> {
	await using adminPool = createDisposableAdminPool(
		adminConnectionUrl.toString(),
	);
	await createDatabase(adminPool.pool, templateDbName);
}

// Runs once from integrationGlobalSetup.ts, before any test file starts, so
// the migrations only run once even when test files run in parallel across
// workers. Each test then clones this template instead of migrating from
// scratch (see startTestDatabase below).
export async function buildTestTemplate(
	migrationFolder: string,
): Promise<string> {
	const adminConnectionUrl = readExternalAdminUrl();
	const templateDbName = buildDbName(TEST_TEMPLATE_PREFIX);

	await createTemplateDatabase(adminConnectionUrl, templateDbName);

	await using templateDb = createDisposableMigrationDb(
		buildConnectionString(adminConnectionUrl, templateDbName),
	);
	const migrator = createMigrator(templateDb.db, migrationFolder);
	const { error } = await migrator.migrateToLatest();

	if (error != null) {
		throw error;
	}

	return templateDbName;
}

export async function dropTestTemplate(templateDbName: string): Promise<void> {
	const adminConnectionUrl = readExternalAdminUrl();
	await using adminPool = createDisposableAdminPool(
		adminConnectionUrl.toString(),
	);

	await dropDatabase(adminPool.pool, templateDbName);
}

export async function startTestDatabase(): Promise<StartedTestDatabase> {
	const adminConnectionUrl = readExternalAdminUrl();
	const templateDbName = readTemplateDbName();
	const adminPool = createTestPool(adminConnectionUrl.toString());
	const databaseName = buildDbName(TEST_DATABASE_PREFIX);

	await createDatabaseFromTemplate(adminPool, databaseName, templateDbName);

	const db = new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: createTestPool(
				buildConnectionString(adminConnectionUrl, databaseName),
			),
			cursor: Cursor,
		}),
		plugins: [new CamelCasePlugin()],
	});

	return {
		db,
		cleanup: async () => {
			await dropDatabase(adminPool, databaseName);
			await adminPool.end();
		},
	};
}

export async function stopTestDatabase({
	db,
	cleanup,
}: StartedTestDatabase): Promise<void> {
	await db.destroy();

	if (cleanup != null) {
		await cleanup();
	}
}

export async function createTestDb(): Promise<DisposableTestDatabase> {
	const startedDb = await startTestDatabase();

	return Object.assign(startedDb.db, {
		async [Symbol.asyncDispose](): Promise<void> {
			await stopTestDatabase(startedDb);
		},
	});
}
