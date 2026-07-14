import type { Kysely } from "kysely";
import type { Database } from "#db/generated/database.ts";
import { buildTestId } from "./dbIntegration.ts";

export async function createGridRecord(db: Kysely<Database>, name: string) {
	const grid = await db
		.insertInto("grid")
		.values({ id: buildTestId("grid"), name })
		.returning(["id", "rowId", "name"])
		.executeTakeFirstOrThrow();

	return grid;
}

export async function createGrid(db: Kysely<Database>, name: string) {
	const { rowId, ...grid } = await createGridRecord(db, name);

	return {
		...grid,
		rowId,
		async [Symbol.asyncDispose](): Promise<void> {
			await db.deleteFrom("grid").where("rowId", "=", rowId).execute();
		},
	};
}
