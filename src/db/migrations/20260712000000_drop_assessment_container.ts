import { type Kysely, sql } from "kysely";

// Drops the `assessment` container table. It held one row per
// (grade target × rubric) and carried no evaluation content — only foreign
// keys and timestamps — a day-one fossil of the original
// `app/[questionId]/[paperId]` page structure. Nothing reads anything from it;
// only `criterion_assessment` referenced it. See
// docs/investigations/2026-07-12-assessment-container-table.md.
//
// `criterion_assessment` is rekeyed to hold `grade_target_row_id` directly and
// is made unique on (grade_target_row_id, criterion_id). This also removes the
// integrity redundancy the container created: a criterion grade's rubric was
// derivable two ways (via `assessment.rubric_id` and via `criterion.rubric_id`)
// with no constraint forcing agreement; keyed directly on (target, criterion),
// the rubric is derivable exactly one way.
//
// The redundant `criterion_assessment.kind` column is dropped in the same
// migration: it always equals the immutable, always-joined `criterion.kind`.
// No trigger reads it (the `*_kind_match` triggers are on the criterion subtype
// tables; the grade-subtype triggers key on `criterion_assessment_id`), and
// both readers that selected it already join `criterion`.
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below is passed to Postgres verbatim and matches the live schema
// exactly (see docs/reference/database-migrations.md). Raw SQL is used only for
// the data-moving UPDATE/INSERT statements; all DDL goes through the schema
// builder.

export async function up(db: Kysely<unknown>): Promise<void> {
	// Carry the grade target down onto the grade rows before the container goes.
	await db.schema
		.alterTable("criterion_assessment")
		.addColumn("grade_target_row_id", "integer")
		.execute();

	await sql`
    UPDATE "criterion_assessment" ca
    SET "grade_target_row_id" = a."grade_target_row_id"
    FROM "assessment" a
    WHERE a."id" = ca."assessment_id"
  `.execute(db);

	await db.schema
		.alterTable("criterion_assessment")
		.alterColumn("grade_target_row_id", (column) => column.setNotNull())
		.execute();

	await db.schema
		.alterTable("criterion_assessment")
		.addForeignKeyConstraint(
			"criterion_assessment_grade_target_row_id_fkey",
			["grade_target_row_id"],
			"grade_target",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	// Swap the identity: the container-scoped unique becomes target-scoped.
	await db.schema
		.alterTable("criterion_assessment")
		.addUniqueConstraint(
			"criterion_assessment_grade_target_row_id_criterion_id_key",
			["grade_target_row_id", "criterion_id"],
		)
		.execute();

	await db.schema
		.alterTable("criterion_assessment")
		.dropConstraint("criterion_assessment_assessment_id_criterion_id_key")
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.dropConstraint("criterion_assessment_assessment_id_fkey")
		.execute();

	await db.schema
		.alterTable("criterion_assessment")
		.dropColumn("assessment_id")
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.dropColumn("kind")
		.execute();

	await db.schema.dropTable("assessment").execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Recreate the container. Empty containers (grade targets that started a
	// rubric with no criterion grades written) are not recoverable — they only
	// ever existed as the partial-commit bug state this drop also fixes.
	await db.schema
		.createTable("assessment")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("grade_target_row_id", "integer", (column) => column.notNull())
		.addColumn("project_id", "integer", (column) => column.notNull())
		.addColumn("rubric_id", "integer", (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addUniqueConstraint("assessment_grade_target_row_id_rubric_id_key", [
			"grade_target_row_id",
			"rubric_id",
		])
		.addForeignKeyConstraint(
			"assessment_grade_target_row_id_fkey",
			["grade_target_row_id"],
			"grade_target",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"assessment_project_id_fkey",
			["project_id"],
			"project",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"assessment_rubric_id_fkey",
			["rubric_id"],
			"rubric",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("assessment_project_id_idx")
		.on("assessment")
		.column("project_id")
		.execute();

	await sql`
    INSERT INTO "assessment" ("grade_target_row_id", "project_id", "rubric_id")
    SELECT DISTINCT ca."grade_target_row_id", gt."project_id", c."rubric_id"
    FROM "criterion_assessment" ca
    INNER JOIN "criterion" c ON c."row_id" = ca."criterion_id"
    INNER JOIN "grade_target" gt ON gt."row_id" = ca."grade_target_row_id"
  `.execute(db);

	await db.schema
		.alterTable("criterion_assessment")
		.addColumn("assessment_id", "integer")
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.addColumn("kind", sql`"criterion_kind"`)
		.execute();

	await sql`
    UPDATE "criterion_assessment" ca
    SET "assessment_id" = a."id"
    FROM "assessment" a
    INNER JOIN "criterion" c ON c."rubric_id" = a."rubric_id"
    WHERE c."row_id" = ca."criterion_id"
      AND a."grade_target_row_id" = ca."grade_target_row_id"
  `.execute(db);
	await sql`
    UPDATE "criterion_assessment" ca
    SET "kind" = c."kind"
    FROM "criterion" c
    WHERE c."row_id" = ca."criterion_id"
  `.execute(db);

	await db.schema
		.alterTable("criterion_assessment")
		.alterColumn("assessment_id", (column) => column.setNotNull())
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.alterColumn("kind", (column) => column.setNotNull())
		.execute();

	await db.schema
		.alterTable("criterion_assessment")
		.addForeignKeyConstraint(
			"criterion_assessment_assessment_id_fkey",
			["assessment_id"],
			"assessment",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.addUniqueConstraint(
			"criterion_assessment_assessment_id_criterion_id_key",
			["assessment_id", "criterion_id"],
		)
		.execute();

	await db.schema
		.alterTable("criterion_assessment")
		.dropConstraint("criterion_assessment_grade_target_row_id_criterion_id_key")
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.dropConstraint("criterion_assessment_grade_target_row_id_fkey")
		.execute();
	await db.schema
		.alterTable("criterion_assessment")
		.dropColumn("grade_target_row_id")
		.execute();
}
