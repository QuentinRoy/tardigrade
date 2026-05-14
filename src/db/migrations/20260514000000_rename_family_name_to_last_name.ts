import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("student")
    .renameColumn("family_name", "last_name")
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("student")
    .renameColumn("last_name", "family_name")
    .execute();
}
