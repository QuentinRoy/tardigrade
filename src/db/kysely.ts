import "server-only";

import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool, types as pgTypes } from "pg";
import Cursor from "pg-cursor";
import type { DB } from "./types";

const PG_NUMERIC_OID = 1700;

pgTypes.setTypeParser(PG_NUMERIC_OID, (value) => Number(value));

function createKyselyClient() {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString == null || connectionString.length === 0) {
    throw new Error("DATABASE_URL is required to initialize Kysely");
  }

  const pool = new Pool({ connectionString });

  return new Kysely<DB>({
    dialect: new PostgresDialect({ pool, cursor: Cursor }),
    plugins: [new CamelCasePlugin()],
  });
}

type AppKyselyClient = ReturnType<typeof createKyselyClient>;

const globalForKysely = globalThis as typeof globalThis & {
  db?: AppKyselyClient;
};

export const db = globalForKysely.db ?? createKyselyClient();

if (process.env.NODE_ENV !== "production") {
  globalForKysely.db = db;
}
