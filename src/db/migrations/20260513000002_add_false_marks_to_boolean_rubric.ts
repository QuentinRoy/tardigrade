import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("boolean_rubric")
    .addColumn("false_marks", "numeric(10, 2)", (column) =>
      column.notNull().defaultTo(sql`0`),
    )
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await db.schema
    .alterTable("boolean_rubric")
    .dropColumn("false_marks")
    .execute();
}
