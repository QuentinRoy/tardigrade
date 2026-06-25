import "server-only";

import { CamelCasePlugin, Kysely, PostgresDialect } from "kysely";
import { Pool, types as pgTypes } from "pg";
import Cursor from "pg-cursor";
import { createLogger } from "../utils/logger.ts";
import type { DB } from "./generated/db.ts";

const PG_NUMERIC_OID = 1700;

pgTypes.setTypeParser(PG_NUMERIC_OID, (value) => Number(value));

const logger = createLogger("db");

function createKyselyClient() {
	const connectionString = process.env["DATABASE_URL"];

	if (connectionString == null || connectionString.length === 0) {
		throw new Error("DATABASE_URL is required to initialize Kysely");
	}

	const pool = new Pool({ connectionString });

	// node-postgres re-emits a backend-initiated client disconnect (Postgres
	// restart, network blip, connection-limit kill, failover, ...) as an
	// 'error' event. A pool-level `pool.on("error", ...)` listener alone is not
	// reliable here: reproducing a multi-connection disconnect locally showed
	// one idle client routinely throwing "Connection terminated unexpectedly"
	// as an uncaught exception instead of emitting on the pool (a known
	// node-postgres gap, https://github.com/brianc/node-postgres/issues/1986).
	// Listening on each client individually catches every case, including that
	// one. With no listener attached to a client, Node's EventEmitter throws,
	// crashing the whole Next.js server process. Logging here instead of
	// throwing keeps a single transient disconnect from taking down the server.
	pool.on("connect", (client) => {
		client.on("error", (error) => {
			// pino only applies its Error serializer (message/type/stack) to the
			// `err` key by default, so the error must be logged under that key.
			logger.error({ err: error }, "Postgres pool error");
		});
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
// biome-ignore lint/plugin/no-type-assertion: c.f. comment above.
const globalForKysely = globalThis as typeof globalThis & {
	db?: AppKyselyClient;
};

export const db = globalForKysely.db ?? createKyselyClient();

if (process.env.NODE_ENV !== "production") {
	globalForKysely.db = db;
}
