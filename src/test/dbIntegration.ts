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

function createDisposableAdminPool(
	connectionString: string,
): Pool & AsyncDisposable {
	const pool = new Pool({ connectionString, max: TEST_DB_POOL_MAX });

	return Object.assign(pool, {
		async [Symbol.asyncDispose](): Promise<void> {
			await pool.end();
		},
	});
}

// Runs once from integrationGlobalSetup.ts, before any test file starts, so
// the migrations only run once even when test files run in parallel across
// workers. Each test then clones this template instead of migrating from
// scratch (see startTestDatabase below).
export async function buildTestTemplate(
	migrationFolder: string,
): Promise<string> {
	const adminConnectionUrl = readExternalAdminUrl();
	await using adminPool = createDisposableAdminPool(
		adminConnectionUrl.toString(),
	);
	const templateDbName = buildDbName(TEST_TEMPLATE_PREFIX);

	await createDatabase(adminPool, templateDbName);

	const templateDb = new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: new Pool({
				connectionString: buildConnectionString(
					adminConnectionUrl,
					templateDbName,
				),
				max: TEST_DB_POOL_MAX,
			}),
		}),
		plugins: [new CamelCasePlugin()],
	});

	try {
		const migrator = createMigrator(templateDb, migrationFolder);
		const { error } = await migrator.migrateToLatest();

		if (error != null) {
			throw error;
		}
	} finally {
		await templateDb.destroy();
	}

	return templateDbName;
}

export async function dropTestTemplate(templateDbName: string): Promise<void> {
	const adminConnectionUrl = readExternalAdminUrl();
	await using adminPool = createDisposableAdminPool(
		adminConnectionUrl.toString(),
	);

	await dropDatabase(adminPool, templateDbName);
}

export async function startTestDatabase(): Promise<StartedTestDatabase> {
	const adminConnectionUrl = readExternalAdminUrl();
	const templateDbName = readTemplateDbName();
	const adminPool = new Pool({
		connectionString: adminConnectionUrl.toString(),
		max: TEST_DB_POOL_MAX,
	});
	const databaseName = buildDbName(TEST_DATABASE_PREFIX);

	await createDatabaseFromTemplate(adminPool, databaseName, templateDbName);

	const db = new Kysely<DB>({
		dialect: new PostgresDialect({
			pool: new Pool({
				connectionString: buildConnectionString(
					adminConnectionUrl,
					databaseName,
				),
				max: TEST_DB_POOL_MAX,
			}),
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
