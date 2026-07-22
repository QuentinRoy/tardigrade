import type { Kysely, KyselyPlugin, QueryResult, UnknownRow } from "kysely";

export type QueryCounter = { count: number };

// Counts every query executed through the wrapped handle by hooking Kysely's
// plugin pipeline instead of the driver, so it works identically against the
// real Postgres pool and needs no query-log parsing. Used by regression tests
// proving that database statement growth stays bounded to chunks and
// Criterion kinds rather than growing per row.
export function withQueryCounter<DB>(db: Kysely<DB>): {
	db: Kysely<DB>;
	counter: QueryCounter;
} {
	const counter: QueryCounter = { count: 0 };

	const plugin: KyselyPlugin = {
		transformQuery({ node }) {
			counter.count += 1;
			return node;
		},
		async transformResult({ result }): Promise<QueryResult<UnknownRow>> {
			return result;
		},
	};

	return { db: db.withPlugin(plugin), counter };
}
