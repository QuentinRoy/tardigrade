import "server-only";

import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool, types as pgTypes } from "pg";
import Cursor from "pg-cursor";
import { logger } from "../logger.ts";
import type { DB } from "./generated/db.ts";

const PG_NUMERIC_OID = 1700;

pgTypes.setTypeParser(PG_NUMERIC_OID, (value) => Number(value));

function createKyselyClient() {
	const connectionString = process.env["DATABASE_URL"];

	if (connectionString == null || connectionString.length === 0) {
		throw new Error("DATABASE_URL is required to initialize Kysely");
	}

	const pool = new Pool({ connectionString });

	// node-postgres re-emits a backend-initiated client disconnect (Postgres
	// restart, network blip, connection-limit kill, failover, ...) as an
	// 'error' event on the pool. With no listener attached, Node's
	// EventEmitter throws, crashing the whole Next.js server process. Logging
	// here instead of throwing keeps a single transient disconnect from
	// taking down the server.
	pool.on("error", (error) => {
		logger.error({ error }, "Postgres pool error");
	});

	return new Kysely<DB>({
		dialect: new PostgresDialect({ pool, cursor: Cursor }),
		plugins: [new CamelCasePlugin()],
	});
}

type AppKyselyClient = ReturnType<typeof createKyselyClient>;

// In development, Next.js Fast Refresh re-runs any module that isn't a pure
// React component on every file save, which would create a new connection pool
// on each reload and exhaust the database connections.
// Storing the client on globalThis (which survives module re-evaluation) prevents
// that. TypeScript does not allow adding arbitrary properties to globalThis without
// a cast; there is no safer alternative short of a global.d.ts declaration merge.
// See: https://nextjs.org/docs/architecture/fast-refresh#how-it-works
const globalForKysely = globalThis as typeof globalThis & {
	db?: AppKyselyClient;
};

export const db = globalForKysely.db ?? createKyselyClient();

if (process.env.NODE_ENV !== "production") {
	globalForKysely.db = db;
}
