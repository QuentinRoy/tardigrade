import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("numerical_rubric")
		.addCheckConstraint(
			"numerical_rubric_score_range_check",
			sql`"max_score" > "min_score"`,
		)
		.execute();

	await db.schema
		.alterTable("numerical_rubric")
		.addCheckConstraint(
			"numerical_rubric_marks_range_check",
			sql`"max_marks" >= "min_marks"`,
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("numerical_rubric")
		.dropConstraint("numerical_rubric_marks_range_check")
		.execute();

	await db.schema
		.alterTable("numerical_rubric")
		.dropConstraint("numerical_rubric_score_range_check")
		.execute();
}
