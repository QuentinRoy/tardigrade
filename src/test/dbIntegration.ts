import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";
import type { DB } from "../db/types";

export type StartedTestDatabase = {
  db: Kysely<DB>;
  cleanup?: () => Promise<void>;
};

type ExternalTemplateContext = {
  adminConnectionUrl: URL;
  templateDbName: string;
};

const TEST_DATABASE_PREFIX = "grading_test_db";
const TEST_TEMPLATE_PREFIX = "grading_test_tpl";
const runTag = sanitizeDbIdentifier(
  process.env.GITHUB_RUN_ID ?? `${Date.now()}_${process.pid}`,
);

let externalTemplatePromise: Promise<ExternalTemplateContext> | null = null;

export function buildTestId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function resolvePathFromMeta(
  importMetaUrl: string,
  relativePath: string,
): string {
  const dirname = path.dirname(fileURLToPath(importMetaUrl));
  return path.join(dirname, relativePath);
}

export function createMigrator(
  dbInstance: Kysely<DB>,
  migrationFolder: string,
): Migrator {
  return new Migrator({
    db: dbInstance,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
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
    `create database ${quoteIdentifier(databaseName)} template ${quoteIdentifier(templateName)}`,
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
  const url = process.env.TEST_DATABASE_URL;

  if (url == null || url.length === 0) {
    throw new Error("TEST_DATABASE_URL must be set for integration tests");
  }

  return new URL(url);
}

async function ensureExternalTemplate(
  migrationFolder: string,
): Promise<ExternalTemplateContext> {
  if (externalTemplatePromise != null) {
    return externalTemplatePromise;
  }

  externalTemplatePromise = (async () => {
    const adminConnectionUrl = readExternalAdminUrl();
    const adminPool = new Pool({
      connectionString: adminConnectionUrl.toString(),
    });
    const templateDbName = buildDbName(TEST_TEMPLATE_PREFIX);

    await createDatabase(adminPool, templateDbName);

    const templateDb = new Kysely<DB>({
      dialect: new PostgresDialect({
        pool: new Pool({
          connectionString: buildConnectionString(
            adminConnectionUrl,
            templateDbName,
          ),
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
      await adminPool.end();
    }

    return {
      adminConnectionUrl,
      templateDbName,
    };
  })();

  return externalTemplatePromise;
}

async function startExternalDatabase(
  migrationFolder: string,
): Promise<StartedTestDatabase> {
  const template = await ensureExternalTemplate(migrationFolder);
  const adminPool = new Pool({
    connectionString: template.adminConnectionUrl.toString(),
  });
  const databaseName = buildDbName(TEST_DATABASE_PREFIX);

  await createDatabaseFromTemplate(
    adminPool,
    databaseName,
    template.templateDbName,
  );

  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({
        connectionString: buildConnectionString(
          template.adminConnectionUrl,
          databaseName,
        ),
      }),
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

export async function startTestDatabase(
  migrationFolder: string,
): Promise<StartedTestDatabase> {
  return startExternalDatabase(migrationFolder);
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
