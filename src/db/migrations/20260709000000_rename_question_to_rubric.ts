import { type Kysely, sql } from "kysely";

// Terminology sweep stage 2b: the container gradeable shape is renamed
// Question -> Rubric. The leaf (Criterion) and the criterion-kind axis landed in
// stage 2a; the assess axis (`assessment`, `saveAssessment`, the `assessment-*`
// modules) is stage 5. Here only the container noun moves: table `question` ->
// `rubric`, and the container FK `question_id` -> `rubric_id` on `criterion` and
// `assessment`. The `assessment` table keeps its name (stage 5); only its FK
// column moves now, so `question`/`question_id` is fully vacated from the schema.
//
// Schema builder for the table rename (renameTo) and the column renames
// (renameColumn). Raw SQL for constraint and index renames only. No enum or
// trigger changes are needed: 2a's enforcement functions/triggers are all
// criterion-scoped and neither `question` nor `assessment` carries a trigger.
//
// Renaming a UNIQUE/PRIMARY KEY constraint also renames its backing index, so the
// only explicit index rename is the one plain (non-constraint) index,
// `question_project_id_idx`.
//
// Constraint renames go through a DO block that looks each constraint up by any
// candidate spelling, bypassing CamelCasePlugin's snake_casing of names passed to
// the schema builder. Earlier migrations created some names verbatim in PascalCase
// (raw SQL) and others snake_cased (builder), so a single plugin-transformed name
// cannot match them all. Same pattern as 20260707000000; see
// docs/reference/database-migrations.md.

export async function up(db: Kysely<unknown>): Promise<void> {
	// Table then columns via the schema builder.
	await db.schema.alterTable("question").renameTo("rubric").execute();
	await db.schema
		.alterTable("criterion")
		.renameColumn("question_id", "rubric_id")
		.execute();
	await db.schema
		.alterTable("assessment")
		.renameColumn("question_id", "rubric_id")
		.execute();

	// Constraints (their backing indexes follow automatically) and the one plain
	// index. Raw SQL: renameConstraint would be snake_cased by CamelCasePlugin and
	// miss the verbatim PascalCase names, and there is no index-rename builder API.
	await sql`
    DO $$
    DECLARE
      item record;
      actual text;
    BEGIN
      FOR item IN
        SELECT * FROM (VALUES
          ('rubric', ARRAY['question_pkey'], 'rubric_pkey'),
          ('rubric', ARRAY['Question_projectId_id_key', 'question_project_id_id_key'], 'Rubric_projectId_id_key'),
          ('rubric', ARRAY['question_project_id_fkey'], 'rubric_project_id_fkey'),
          ('criterion', ARRAY['Criterion_questionId_fkey', 'criterion_question_id_fkey'], 'Criterion_rubricId_fkey'),
          ('criterion', ARRAY['Criterion_questionId_position_key', 'criterion_question_id_position_key'], 'Criterion_rubricId_position_key'),
          ('assessment', ARRAY['Assessment_questionId_fkey', 'assessment_question_id_fkey'], 'Assessment_rubricId_fkey'),
          ('assessment', ARRAY['Assessment_submissionId_questionId_key', 'assessment_submission_id_question_id_key'], 'Assessment_submissionId_rubricId_key')
        ) AS t(tbl, oldnames, newname)
      LOOP
        SELECT conname INTO actual
        FROM pg_constraint
        WHERE conrelid = item.tbl::regclass AND conname = ANY(item.oldnames)
        LIMIT 1;

        IF actual IS NOT NULL AND actual <> item.newname THEN
          EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', item.tbl, actual, item.newname);
        END IF;
      END LOOP;
    END $$;

    ALTER INDEX IF EXISTS "question_project_id_idx" RENAME TO "rubric_project_id_idx";
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Constraints and index back first (their names are still the new spelling and
	// the table is still `rubric`), then columns, then the table.
	await sql`
    DO $$
    DECLARE
      item record;
      actual text;
    BEGIN
      FOR item IN
        SELECT * FROM (VALUES
          ('rubric', ARRAY['rubric_pkey'], 'question_pkey'),
          ('rubric', ARRAY['Rubric_projectId_id_key'], 'Question_projectId_id_key'),
          ('rubric', ARRAY['rubric_project_id_fkey'], 'question_project_id_fkey'),
          ('criterion', ARRAY['Criterion_rubricId_fkey'], 'Criterion_questionId_fkey'),
          ('criterion', ARRAY['Criterion_rubricId_position_key'], 'Criterion_questionId_position_key'),
          ('assessment', ARRAY['Assessment_rubricId_fkey'], 'Assessment_questionId_fkey'),
          ('assessment', ARRAY['Assessment_submissionId_rubricId_key'], 'Assessment_submissionId_questionId_key')
        ) AS t(tbl, oldnames, newname)
      LOOP
        SELECT conname INTO actual
        FROM pg_constraint
        WHERE conrelid = item.tbl::regclass AND conname = ANY(item.oldnames)
        LIMIT 1;

        IF actual IS NOT NULL AND actual <> item.newname THEN
          EXECUTE format('ALTER TABLE %I RENAME CONSTRAINT %I TO %I', item.tbl, actual, item.newname);
        END IF;
      END LOOP;
    END $$;

    ALTER INDEX IF EXISTS "rubric_project_id_idx" RENAME TO "question_project_id_idx";
  `.execute(db);

	await db.schema
		.alterTable("assessment")
		.renameColumn("rubric_id", "question_id")
		.execute();
	await db.schema
		.alterTable("criterion")
		.renameColumn("rubric_id", "question_id")
		.execute();
	await db.schema.alterTable("rubric").renameTo("question").execute();
}
