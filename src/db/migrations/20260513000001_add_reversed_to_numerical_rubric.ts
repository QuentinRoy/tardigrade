import { type Kysely } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("numerical_rubric")
    .addColumn("reversed", "boolean", (column) =>
      column.notNull().defaultTo(false),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("numerical_rubric")
    .dropColumn("reversed")
    .execute();
}
