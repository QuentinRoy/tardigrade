import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	// Adding a CHECK constraint validates existing rows and aborts the migration
	// if any violate. Surface the offending rubrics with an actionable message
	// instead of Postgres's generic "violated by some row" error, since the
	// editor could have persisted an out-of-bounds rubric before this migration
	// and its matching write-boundary guards closed that gap.
	const violations = await sql<{ rubric_id: string }>`
		SELECT "rubric_id"
		FROM "numerical_rubric"
		WHERE "max_score" <= "min_score" OR "max_marks" < "min_marks"
	`.execute(db);

	if (violations.rows.length > 0) {
		const offendingRubricIds = violations.rows
			.map((row) => row.rubric_id)
			.join(", ");
		throw new Error(
			`Cannot enforce numerical rubric bounds: ${violations.rows.length} ` +
				`row(s) violate max_score > min_score or max_marks >= min_marks ` +
				`(rubric_id: ${offendingRubricIds}). Fix these rows before re-running ` +
				`the migration.`,
		);
	}

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
