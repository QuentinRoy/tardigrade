import { type Kysely, sql } from "kysely";

// Enforces Part 2 of cross-grid integrity (#144, ADR 0015): a criterion_grade
// (the cell) may only pair a criterion and a grade_target from the same grid.
// `grid_row_id` is added as a replicated consistency copy (backfilled from the
// criterion side) and backs two composite FKs, one per side of the pair, so a
// cross-grid cell is structurally impossible rather than only rejected by the
// app layer. No direct FK to `grid`: validity is guaranteed transitively by
// the two composite FKs (decision 5 of the plan).

export async function up(db: Kysely<unknown>): Promise<void> {
	// Adding the composite FKs later would otherwise fail with Postgres's
	// generic "violates foreign key constraint" error. Surface the offending
	// cells with an actionable message instead, since the app layer could have
	// persisted a cross-grid pairing before this migration existed.
	const violations = await sql<{ id: number }>`
		SELECT cg."id"
		FROM "criterion_grade" cg
		INNER JOIN "criterion" c ON c."row_id" = cg."criterion_id"
		INNER JOIN "grade_target" gt ON gt."row_id" = cg."grade_target_row_id"
		WHERE c."grid_row_id" <> gt."grid_row_id"
	`.execute(db);

	if (violations.rows.length > 0) {
		const offendingCriterionGradeIds = violations.rows
			.map((row) => row.id)
			.join(", ");
		throw new Error(
			`Cannot enforce criterion_grade grid consistency: ${violations.rows.length} ` +
				`criterion_grade row(s) pair a criterion and a grade_target from ` +
				`different grids (criterion_grade id: ${offendingCriterionGradeIds}). ` +
				`Fix these rows by hand before re-running the migration.`,
		);
	}

	// Nullable until backfilled below.
	await db.schema
		.alterTable("criterion_grade")
		.addColumn("grid_row_id", "integer")
		.execute();

	// Backfilled from the criterion side; the pre-check above guarantees this
	// agrees with the grade_target side.
	await sql`
		UPDATE "criterion_grade"
		SET "grid_row_id" = c."grid_row_id"
		FROM "criterion" c
		WHERE c."row_id" = "criterion_grade"."criterion_id"
	`.execute(db);

	await db.schema
		.alterTable("criterion_grade")
		.alterColumn("grid_row_id", (column) => column.setNotNull())
		.execute();

	// Back the composite FKs below: (row_id, grid_row_id) is trivially unique
	// since row_id alone already is, but Postgres requires the referenced
	// column set to have a unique constraint of its own.
	await db.schema
		.alterTable("criterion")
		.addUniqueConstraint("criterion_row_id_grid_row_id_key", [
			"row_id",
			"grid_row_id",
		])
		.execute();

	await db.schema
		.alterTable("grade_target")
		.addUniqueConstraint("grade_target_row_id_grid_row_id_key", [
			"row_id",
			"grid_row_id",
		])
		.execute();

	// Intentionally no index on criterion_grade.grid_row_id: the cell is loaded
	// per grade-target, never by grid, so there is no query to back yet. Add
	// one only if a grid-scoped cell query appears (plan decision 6).

	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_grade_target_row_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.addForeignKeyConstraint(
			"criterion_grade_grade_target_row_id_grid_row_id_fkey",
			["grade_target_row_id", "grid_row_id"],
			"grade_target",
			["row_id", "grid_row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_criterion_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.addForeignKeyConstraint(
			"criterion_grade_criterion_id_grid_row_id_fkey",
			["criterion_id", "grid_row_id"],
			"criterion",
			["row_id", "grid_row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_criterion_id_grid_row_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.addForeignKeyConstraint(
			"criterion_grade_criterion_id_fkey",
			["criterion_id"],
			"criterion",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_grade_target_row_id_grid_row_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.addForeignKeyConstraint(
			"criterion_grade_grade_target_row_id_fkey",
			["grade_target_row_id"],
			"grade_target",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("grade_target")
		.dropConstraint("grade_target_row_id_grid_row_id_key")
		.execute();

	await db.schema
		.alterTable("criterion")
		.dropConstraint("criterion_row_id_grid_row_id_key")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.dropColumn("grid_row_id")
		.execute();
}
