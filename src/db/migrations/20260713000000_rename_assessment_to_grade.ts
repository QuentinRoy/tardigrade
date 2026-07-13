import { type Kysely, sql } from "kysely";

// Renames the criterion-grade tables from the retired "assessment" word to
// "grade": `criterion_assessment` → `criterion_grade` and its three kind
// subtypes `{check,options,number}_criterion_assessment` →
// `{check,options,number}_criterion_grade`, with the subtype foreign-key column
// `criterion_assessment_id` → `criterion_grade_id`. The recorded evaluation of a
// criterion is a Grade (see CONTEXT.md); "assessment" is no longer domain
// vocabulary.
//
// The two grade-subtype trigger functions
// (`enforce_options_criterion_label_valid`, `enforce_number_criterion_score_bounds`)
// read the parent table and the FK column by name in their bodies, so they are
// re-created against the new names. The triggers themselves stay attached to the
// renamed subtype tables automatically. The `*_kind_match` and immutability
// triggers live on the criterion subtype tables (unaffected here).
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below is passed to Postgres verbatim and matches the live schema
// exactly (see docs/reference/database-migrations.md). All post-snake_case names
// are deterministic, so constraints/indexes rename with plain `renameConstraint`
// (renaming a UNIQUE/PK constraint auto-renames its backing index). Raw SQL is
// used only for the trigger-function bodies, which the schema builder can't
// express. DDL runs one statement at a time (concurrent ALTER only contends for
// locks).

const subtypes = ["check", "options", "number"] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("criterion_assessment")
		.renameTo("criterion_grade")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint("criterion_assessment_pkey", "criterion_grade_pkey")
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_assessment_criterion_id_fkey",
			"criterion_grade_criterion_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_assessment_grade_target_row_id_fkey",
			"criterion_grade_grade_target_row_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_assessment_grade_target_row_id_criterion_id_key",
			"criterion_grade_grade_target_row_id_criterion_id_key",
		)
		.execute();

	for (const subtype of subtypes) {
		await db.schema
			.alterTable(`${subtype}_criterion_assessment`)
			.renameTo(`${subtype}_criterion_grade`)
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameColumn("criterion_assessment_id", "criterion_grade_id")
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameConstraint(
				`${subtype}_criterion_assessment_pkey`,
				`${subtype}_criterion_grade_pkey`,
			)
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameConstraint(
				`${subtype}_criterion_assessment_criterion_assessment_id_fkey`,
				`${subtype}_criterion_grade_criterion_grade_id_fkey`,
			)
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameConstraint(
				`${subtype}_criterion_assessment_criterion_assessment_id_key`,
				`${subtype}_criterion_grade_criterion_grade_id_key`,
			)
			.execute();
	}

	await sql`
    CREATE OR REPLACE FUNCTION enforce_options_criterion_label_valid()
    RETURNS trigger AS $$
    DECLARE
      label_exists boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM "criterion_grade" cg
        INNER JOIN "options_criterion" oc ON oc.criterion_id = cg.criterion_id
        INNER JOIN "options_criterion_mark" ocm ON ocm.options_criterion_id = oc.id
        WHERE cg.id = NEW.criterion_grade_id
          AND ocm.label = NEW.selected_label
      ) INTO label_exists;

      IF NOT label_exists THEN
        RAISE EXCEPTION 'OptionsCriterionGrade selected_label "%" is not a valid label for criterion_grade %', NEW.selected_label, NEW.criterion_grade_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

	await sql`
    CREATE OR REPLACE FUNCTION enforce_number_criterion_score_bounds()
    RETURNS trigger AS $$
    DECLARE
      min_score numeric;
      max_score numeric;
    BEGIN
      SELECT nc.min_score, nc.max_score
      INTO min_score, max_score
      FROM "number_criterion" nc
      INNER JOIN "criterion_grade" cg ON cg.criterion_id = nc.criterion_id
      WHERE cg.id = NEW.criterion_grade_id;

      IF min_score IS NULL THEN
        RAISE EXCEPTION 'NumberCriterionGrade % references no NumberCriterion', NEW.criterion_grade_id;
      END IF;

      IF NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'NumberCriterionGrade score % is out of bounds [%, %]', NEW.score, min_score, max_score;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`
    CREATE OR REPLACE FUNCTION enforce_options_criterion_label_valid()
    RETURNS trigger AS $$
    DECLARE
      label_exists boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM "criterion_assessment" ca
        INNER JOIN "options_criterion" oc ON oc.criterion_id = ca.criterion_id
        INNER JOIN "options_criterion_mark" ocm ON ocm.options_criterion_id = oc.id
        WHERE ca.id = NEW.criterion_assessment_id
          AND ocm.label = NEW.selected_label
      ) INTO label_exists;

      IF NOT label_exists THEN
        RAISE EXCEPTION 'OptionsCriterionAssessment selected_label "%" is not a valid label for criterion_assessment %', NEW.selected_label, NEW.criterion_assessment_id;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

	await sql`
    CREATE OR REPLACE FUNCTION enforce_number_criterion_score_bounds()
    RETURNS trigger AS $$
    DECLARE
      min_score numeric;
      max_score numeric;
    BEGIN
      SELECT nc.min_score, nc.max_score
      INTO min_score, max_score
      FROM "number_criterion" nc
      INNER JOIN "criterion_assessment" ca ON ca.criterion_id = nc.criterion_id
      WHERE ca.id = NEW.criterion_assessment_id;

      IF min_score IS NULL THEN
        RAISE EXCEPTION 'NumberCriterionAssessment % references no NumberCriterion', NEW.criterion_assessment_id;
      END IF;

      IF NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'NumberCriterionAssessment score % is out of bounds [%, %]', NEW.score, min_score, max_score;
      END IF;

      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `.execute(db);

	for (const subtype of subtypes) {
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameConstraint(
				`${subtype}_criterion_grade_criterion_grade_id_key`,
				`${subtype}_criterion_assessment_criterion_assessment_id_key`,
			)
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameConstraint(
				`${subtype}_criterion_grade_criterion_grade_id_fkey`,
				`${subtype}_criterion_assessment_criterion_assessment_id_fkey`,
			)
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameConstraint(
				`${subtype}_criterion_grade_pkey`,
				`${subtype}_criterion_assessment_pkey`,
			)
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameColumn("criterion_grade_id", "criterion_assessment_id")
			.execute();
		await db.schema
			.alterTable(`${subtype}_criterion_grade`)
			.renameTo(`${subtype}_criterion_assessment`)
			.execute();
	}

	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_grade_grade_target_row_id_criterion_id_key",
			"criterion_assessment_grade_target_row_id_criterion_id_key",
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_grade_grade_target_row_id_fkey",
			"criterion_assessment_grade_target_row_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_grade_criterion_id_fkey",
			"criterion_assessment_criterion_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint("criterion_grade_pkey", "criterion_assessment_pkey")
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.renameTo("criterion_assessment")
		.execute();
}
