import type { Kysely } from "kysely";
import type { DB } from "../db/generated/db";
import { buildTestId } from "./dbIntegration";

export async function createProjectRecord(db: Kysely<DB>, name: string) {
	const project = await db
		.insertInto("project")
		.values({ id: buildTestId("project"), name })
		.returning(["id", "rowId", "name"])
		.executeTakeFirstOrThrow();

	return project;
}

export async function createProject(db: Kysely<DB>, name: string) {
	const { rowId, ...project } = await createProjectRecord(db, name);

	return {
		...project,
		rowId,
		async [Symbol.asyncDispose](): Promise<void> {
			await db.deleteFrom("project").where("rowId", "=", rowId).execute();
		},
	};
}
