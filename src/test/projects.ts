import type { Kysely } from "kysely";
import type { DB } from "../db/types";
import { buildTestId } from "./dbIntegration";

export async function createProject(
  db: Kysely<DB>,
  name: string,
  createdProjectIds?: number[],
): Promise<number> {
  const project = await db
    .insertInto("project")
    .values({
      publicId: buildTestId("project"),
      name,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  createdProjectIds?.push(project.id);

  return project.id;
}

export async function cleanupProjects(
  db: Kysely<DB>,
  projectIds: number[],
): Promise<void> {
  if (projectIds.length === 0) {
    return;
  }

  await db.deleteFrom("project").where("id", "in", projectIds).execute();
  projectIds.length = 0;
}
