import { type Kysely, sql } from "kysely";

// Enforces Part 1 of cross-grid integrity (#144, ADR 0015): a criterion may
// only reference a rubric in its own grid. Replaces the single-column
// `criterion_rubric_id_fkey` with a composite FK against
// `rubric(row_id, grid_row_id)`, so a cross-grid criterion/rubric pairing is
// structurally impossible rather than only rejected by the app layer.

export async function up(db: Kysely<unknown>): Promise<void> {
	// Adding the composite FK below would otherwise fail with Postgres's
	// generic "violates foreign key constraint" error. Surface the offending
	// criteria with an actionable message instead, since the app layer could
	// have persisted a cross-grid pairing before this migration existed.
	const violations = await sql<{ id: string }>`
		SELECT c."id"
		FROM "criterion" c
		INNER JOIN "rubric" r ON r."row_id" = c."rubric_id"
		WHERE c."grid_row_id" <> r."grid_row_id"
	`.execute(db);

	if (violations.rows.length > 0) {
		const offendingCriterionIds = violations.rows
			.map((row) => row.id)
			.join(", ");
		throw new Error(
			`Cannot enforce criterion/rubric grid consistency: ${violations.rows.length} ` +
				`criterion row(s) reference a rubric in a different grid ` +
				`(criterion id: ${offendingCriterionIds}). Fix these rows by hand ` +
				`before re-running the migration.`,
		);
	}

	// Backs the composite FK below: (row_id, grid_row_id) is trivially unique
	// since row_id alone already is, but Postgres requires the referenced
	// column set to have a unique constraint of its own.
	await db.schema
		.alterTable("rubric")
		.addUniqueConstraint("rubric_row_id_grid_row_id_key", [
			"row_id",
			"grid_row_id",
		])
		.execute();

	await db.schema
		.alterTable("criterion")
		.dropConstraint("criterion_rubric_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion")
		.addForeignKeyConstraint(
			"criterion_rubric_id_grid_row_id_fkey",
			["rubric_id", "grid_row_id"],
			"rubric",
			["row_id", "grid_row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("criterion")
		.dropConstraint("criterion_rubric_id_grid_row_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion")
		.addForeignKeyConstraint(
			"criterion_rubric_id_fkey",
			["rubric_id"],
			"rubric",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("rubric")
		.dropConstraint("rubric_row_id_grid_row_id_key")
		.execute();
}
