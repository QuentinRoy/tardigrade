import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";
import type { DB } from "../db/types";

export type StartedTestDatabase = {
  container: StartedPostgreSqlContainer;
  db: Kysely<DB>;
};

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

export async function startTestDatabase(
  migrationFolder: string,
): Promise<StartedTestDatabase> {
  const container = await new PostgreSqlContainer("postgres:17-alpine").start();

  const db = new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString: container.getConnectionUri() }),
    }),
    plugins: [new CamelCasePlugin()],
  });

  const migrator = createMigrator(db, migrationFolder);
  const { error } = await migrator.migrateToLatest();

  if (error != null) {
    throw error;
  }

  return { container, db };
}

export async function stopTestDatabase({
  db,
  container,
}: StartedTestDatabase): Promise<void> {
  await db.destroy();
  await container.stop();
}
