import { type Kysely, sql } from "kysely";

// Terminology sweep stage 2a: the leaf gradeable item is renamed Rubric ->
// Criterion, with the criterion-kind rename folded in (boolean/ordinal/numerical
// -> check/options/number). The subtype tables go straight to their final names
// in one hop. The container `question` and the assess axis (`assessment`,
// `rubric_assessment` -> here `criterion_assessment` keeps the "assessment" word)
// are handled by later stages; `question_id` on `criterion`/`assessment` and the
// score/value columns are intentionally left for stages 2b and 7b.
//
// The schema builder is used wherever it has an API: the enum rename (alterType),
// tables (renameTo), and columns (renameColumn). Raw SQL is used for the rest --
// constraint renames, index renames, and trigger/function management.
//
// Constraint renames go through raw SQL rather than `alterTable().renameConstraint`
// because both runners build Kysely with CamelCasePlugin, which snake_cases the
// name passed to the builder. Earlier migrations created some constraints via the
// builder (stored snake_cased) and re-created others via raw SQL (stored verbatim,
// e.g. "Rubric_projectId_id_key"), so a single plugin-transformed name cannot
// match them all. The DO block below looks each constraint up by any of its
// candidate spellings, which sidesteps the transform entirely. See
// docs/reference/database-migrations.md.

const TABLE_RENAMES: ReadonlyArray<readonly [string, string]> = [
	["rubric", "criterion"],
	["boolean_rubric", "check_criterion"],
	["ordinal_rubric", "options_criterion"],
	["ordinal_rubric_value", "options_criterion_mark"],
	["numerical_rubric", "number_criterion"],
	["rubric_assessment", "criterion_assessment"],
	["boolean_rubric_assessment", "check_criterion_assessment"],
	["ordinal_rubric_assessment", "options_criterion_assessment"],
	["numerical_rubric_assessment", "number_criterion_assessment"],
];

// [table, fromColumn, toColumn]; table is the post-rename table name.
const COLUMN_RENAMES: ReadonlyArray<readonly [string, string, string]> = [
	["criterion", "type", "kind"],
	["criterion_assessment", "type", "kind"],
	["criterion_assessment", "rubric_id", "criterion_id"],
	["check_criterion", "rubric_id", "criterion_id"],
	["options_criterion", "rubric_id", "criterion_id"],
	["number_criterion", "rubric_id", "criterion_id"],
	["options_criterion_mark", "ordinal_rubric_id", "options_criterion_id"],
	[
		"check_criterion_assessment",
		"rubric_assessment_id",
		"criterion_assessment_id",
	],
	[
		"options_criterion_assessment",
		"rubric_assessment_id",
		"criterion_assessment_id",
	],
	[
		"number_criterion_assessment",
		"rubric_assessment_id",
		"criterion_assessment_id",
	],
];

async function renameTablesThenColumns(
	db: Kysely<unknown>,
	tableRenames: ReadonlyArray<readonly [string, string]>,
	columnRenames: ReadonlyArray<readonly [string, string, string]>,
): Promise<void> {
	// Sequential on purpose. Each ALTER TABLE takes an ACCESS EXCLUSIVE lock, so
	// running these concurrently (Promise.all) only makes them contend for locks
	// on the same and FK-related tables; it is a one-time migration, so there is
	// nothing to gain and deadlocks to risk.
	for (const [from, to] of tableRenames) {
		await db.schema.alterTable(from).renameTo(to).execute();
	}
	for (const [table, from, to] of columnRenames) {
		await db.schema.alterTable(table).renameColumn(from, to).execute();
	}
}

export async function up(db: Kysely<unknown>): Promise<void> {
	// Drop triggers and functions (recreated at the end). Raw SQL: the schema
	// builder has no trigger/function API.
	await sql`
    DROP TRIGGER IF EXISTS trg_rubric_type_immutable ON "rubric";
    DROP TRIGGER IF EXISTS trg_boolean_rubric_type_match ON "boolean_rubric";
    DROP TRIGGER IF EXISTS trg_ordinal_rubric_type_match ON "ordinal_rubric";
    DROP TRIGGER IF EXISTS trg_numerical_rubric_type_match ON "numerical_rubric";
    DROP TRIGGER IF EXISTS trg_ordinal_label_valid ON "ordinal_rubric_assessment";
    DROP TRIGGER IF EXISTS trg_numerical_score_bounds ON "numerical_rubric_assessment";

    DROP FUNCTION IF EXISTS enforce_rubric_type_immutable();
    DROP FUNCTION IF EXISTS enforce_boolean_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_ordinal_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_numerical_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_ordinal_label_valid();
    DROP FUNCTION IF EXISTS enforce_numerical_score_bounds();
  `.execute(db);

	// Enum type and values via the schema builder. renameTo must precede the
	// value renames (they target the new type name), and the value renames all
	// lock the same type, so this group stays sequential.
	await db.schema.alterType("rubric_type").renameTo("criterion_kind").execute();
	await db.schema
		.alterType("criterion_kind")
		.renameValue("boolean", "check")
		.execute();
	await db.schema
		.alterType("criterion_kind")
		.renameValue("ordinal", "options")
		.execute();
	await db.schema
		.alterType("criterion_kind")
		.renameValue("numerical", "number")
		.execute();

	// Tables and columns via the schema builder.
	await renameTablesThenColumns(db, TABLE_RENAMES, COLUMN_RENAMES);

	// Constraints and indexes. Raw SQL: renameConstraint would be snake_cased by
	// CamelCasePlugin and miss the verbatim raw-SQL-created constraints, and there
	// is no index-rename builder API. Match each object by any candidate spelling.
	await sql`
    DO $$
    DECLARE
      item record;
      actual text;
    BEGIN
      FOR item IN
        SELECT * FROM (VALUES
          ('criterion', ARRAY['rubric_pkey'], 'criterion_pkey'),
          ('criterion', ARRAY['Rubric_projectId_id_key', 'rubric_project_id_id_key'], 'Criterion_projectId_id_key'),
          ('criterion', ARRAY['Rubric_questionId_position_key', 'rubric_question_id_position_key'], 'Criterion_questionId_position_key'),
          ('criterion', ARRAY['Rubric_projectId_fkey', 'rubric_project_id_fkey'], 'Criterion_projectId_fkey'),
          ('criterion', ARRAY['Rubric_questionId_fkey', 'rubric_question_id_fkey'], 'Criterion_questionId_fkey'),
          ('criterion_assessment', ARRAY['rubric_assessment_pkey'], 'criterion_assessment_pkey'),
          ('criterion_assessment', ARRAY['RubricAssessment_assessmentId_rubricId_key', 'rubric_assessment_assessment_id_rubric_id_key'], 'CriterionAssessment_assessmentId_criterionId_key'),
          ('criterion_assessment', ARRAY['RubricAssessment_assessmentId_fkey', 'rubric_assessment_assessment_id_fkey'], 'CriterionAssessment_assessmentId_fkey'),
          ('criterion_assessment', ARRAY['RubricAssessment_rubricId_fkey', 'rubric_assessment_rubric_id_fkey'], 'CriterionAssessment_criterionId_fkey'),
          ('check_criterion', ARRAY['boolean_rubric_pkey'], 'check_criterion_pkey'),
          ('check_criterion', ARRAY['boolean_rubric_rubric_id_key'], 'check_criterion_criterion_id_key'),
          ('check_criterion', ARRAY['BooleanRubric_rubricId_fkey', 'boolean_rubric_rubric_id_fkey'], 'CheckCriterion_criterionId_fkey'),
          ('options_criterion', ARRAY['ordinal_rubric_pkey'], 'options_criterion_pkey'),
          ('options_criterion', ARRAY['ordinal_rubric_rubric_id_key'], 'options_criterion_criterion_id_key'),
          ('options_criterion', ARRAY['OrdinalRubric_rubricId_fkey', 'ordinal_rubric_rubric_id_fkey'], 'OptionsCriterion_criterionId_fkey'),
          ('options_criterion_mark', ARRAY['ordinal_rubric_value_pkey'], 'options_criterion_mark_pkey'),
          ('options_criterion_mark', ARRAY['OrdinalRubricValue_ordinalRubricId_label_key', 'ordinal_rubric_value_ordinal_rubric_id_label_key'], 'OptionsCriterionMark_optionsCriterionId_label_key'),
          ('options_criterion_mark', ARRAY['OrdinalRubricValue_ordinalRubricId_fkey', 'ordinal_rubric_value_ordinal_rubric_id_fkey'], 'OptionsCriterionMark_optionsCriterionId_fkey'),
          ('number_criterion', ARRAY['numerical_rubric_pkey'], 'number_criterion_pkey'),
          ('number_criterion', ARRAY['numerical_rubric_rubric_id_key'], 'number_criterion_criterion_id_key'),
          ('number_criterion', ARRAY['numerical_rubric_marks_range_check'], 'number_criterion_marks_range_check'),
          ('number_criterion', ARRAY['numerical_rubric_score_range_check'], 'number_criterion_score_range_check'),
          ('number_criterion', ARRAY['NumericalRubric_rubricId_fkey', 'numerical_rubric_rubric_id_fkey'], 'NumberCriterion_criterionId_fkey'),
          ('check_criterion_assessment', ARRAY['boolean_rubric_assessment_pkey'], 'check_criterion_assessment_pkey'),
          ('check_criterion_assessment', ARRAY['boolean_rubric_assessment_rubric_assessment_id_key'], 'check_criterion_assessment_criterion_assessment_id_key'),
          ('check_criterion_assessment', ARRAY['BooleanRubricAssessment_rubricAssessmentId_fkey', 'boolean_rubric_assessment_rubric_assessment_id_fkey'], 'CheckCriterionAssessment_criterionAssessmentId_fkey'),
          ('options_criterion_assessment', ARRAY['ordinal_rubric_assessment_pkey'], 'options_criterion_assessment_pkey'),
          ('options_criterion_assessment', ARRAY['ordinal_rubric_assessment_rubric_assessment_id_key'], 'options_criterion_assessment_criterion_assessment_id_key'),
          ('options_criterion_assessment', ARRAY['OrdinalRubricAssessment_rubricAssessmentId_fkey', 'ordinal_rubric_assessment_rubric_assessment_id_fkey'], 'OptionsCriterionAssessment_criterionAssessmentId_fkey'),
          ('number_criterion_assessment', ARRAY['numerical_rubric_assessment_pkey'], 'number_criterion_assessment_pkey'),
          ('number_criterion_assessment', ARRAY['numerical_rubric_assessment_rubric_assessment_id_key'], 'number_criterion_assessment_criterion_assessment_id_key'),
          ('number_criterion_assessment', ARRAY['NumericalRubricAssessment_rubricAssessmentId_fkey', 'numerical_rubric_assessment_rubric_assessment_id_fkey'], 'NumberCriterionAssessment_criterionAssessmentId_fkey')
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

    ALTER INDEX IF EXISTS "rubric_project_id_idx" RENAME TO "criterion_project_id_idx";
    ALTER INDEX IF EXISTS "OrdinalRubricValue_ordinalRubricId_label_idx" RENAME TO "OptionsCriterionMark_optionsCriterionId_label_idx";
    ALTER INDEX IF EXISTS "ordinal_rubric_value_ordinal_rubric_id_label_idx" RENAME TO "OptionsCriterionMark_optionsCriterionId_label_idx";
  `.execute(db);

	// Recreate kind-match, immutability, bounds, and label-valid enforcement.
	await sql`
    CREATE OR REPLACE FUNCTION enforce_check_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'CheckCriterion references unknown Criterion row id: %', NEW."criterion_id";
      END IF;

      IF criterion_kind <> 'check'::"criterion_kind" THEN
        RAISE EXCEPTION 'CheckCriterion with criterionId % requires Criterion.kind check, got %', NEW."criterion_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_options_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'OptionsCriterion references unknown Criterion row id: %', NEW."criterion_id";
      END IF;

      IF criterion_kind <> 'options'::"criterion_kind" THEN
        RAISE EXCEPTION 'OptionsCriterion with criterionId % requires Criterion.kind options, got %', NEW."criterion_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_number_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'NumberCriterion references unknown Criterion row id: %', NEW."criterion_id";
      END IF;

      IF criterion_kind <> 'number'::"criterion_kind" THEN
        RAISE EXCEPTION 'NumberCriterion with criterionId % requires Criterion.kind number, got %', NEW."criterion_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_criterion_kind_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.kind <> OLD.kind THEN
        RAISE EXCEPTION 'Cannot change Criterion % kind from % to %: Criterion.kind is immutable', OLD.id, OLD.kind, NEW.kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_number_criterion_score_bounds()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
    $$;

    CREATE OR REPLACE FUNCTION enforce_options_criterion_label_valid()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
    $$;

    CREATE TRIGGER trg_check_criterion_kind_match
    BEFORE INSERT OR UPDATE OF "criterion_id" ON "check_criterion"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_check_criterion_kind_match();

    CREATE TRIGGER trg_options_criterion_kind_match
    BEFORE INSERT OR UPDATE OF "criterion_id" ON "options_criterion"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_options_criterion_kind_match();

    CREATE TRIGGER trg_number_criterion_kind_match
    BEFORE INSERT OR UPDATE OF "criterion_id" ON "number_criterion"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_number_criterion_kind_match();

    CREATE TRIGGER trg_criterion_kind_immutable
    BEFORE UPDATE OF kind ON "criterion"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_criterion_kind_immutable();

    CREATE TRIGGER trg_number_criterion_score_bounds
    BEFORE INSERT OR UPDATE OF score, criterion_assessment_id ON "number_criterion_assessment"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_number_criterion_score_bounds();

    CREATE TRIGGER trg_options_criterion_label_valid
    BEFORE INSERT OR UPDATE OF selected_label, criterion_assessment_id ON "options_criterion_assessment"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_options_criterion_label_valid();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Drop the new triggers/functions (raw; no builder API).
	await sql`
    DROP TRIGGER IF EXISTS trg_criterion_kind_immutable ON "criterion";
    DROP TRIGGER IF EXISTS trg_check_criterion_kind_match ON "check_criterion";
    DROP TRIGGER IF EXISTS trg_options_criterion_kind_match ON "options_criterion";
    DROP TRIGGER IF EXISTS trg_number_criterion_kind_match ON "number_criterion";
    DROP TRIGGER IF EXISTS trg_options_criterion_label_valid ON "options_criterion_assessment";
    DROP TRIGGER IF EXISTS trg_number_criterion_score_bounds ON "number_criterion_assessment";

    DROP FUNCTION IF EXISTS enforce_criterion_kind_immutable();
    DROP FUNCTION IF EXISTS enforce_check_criterion_kind_match();
    DROP FUNCTION IF EXISTS enforce_options_criterion_kind_match();
    DROP FUNCTION IF EXISTS enforce_number_criterion_kind_match();
    DROP FUNCTION IF EXISTS enforce_options_criterion_label_valid();
    DROP FUNCTION IF EXISTS enforce_number_criterion_score_bounds();
  `.execute(db);

	// Constraints and indexes back. up() renamed each to a single literal, so the
	// down candidate is that literal; this restores the prior spelling.
	await sql`
    DO $$
    DECLARE
      item record;
      actual text;
    BEGIN
      FOR item IN
        SELECT * FROM (VALUES
          ('criterion', ARRAY['criterion_pkey'], 'rubric_pkey'),
          ('criterion', ARRAY['Criterion_projectId_id_key'], 'Rubric_projectId_id_key'),
          ('criterion', ARRAY['Criterion_questionId_position_key'], 'Rubric_questionId_position_key'),
          -- 20260527 created this FK verbatim via the schema builder
          -- (migration runners carry no name-transforming plugin), so this is
          -- its spelling before up().
          ('criterion', ARRAY['Criterion_projectId_fkey'], 'Rubric_projectId_fkey'),
          ('criterion', ARRAY['Criterion_questionId_fkey'], 'Rubric_questionId_fkey'),
          ('criterion_assessment', ARRAY['criterion_assessment_pkey'], 'rubric_assessment_pkey'),
          ('criterion_assessment', ARRAY['CriterionAssessment_assessmentId_criterionId_key'], 'RubricAssessment_assessmentId_rubricId_key'),
          ('criterion_assessment', ARRAY['CriterionAssessment_assessmentId_fkey'], 'RubricAssessment_assessmentId_fkey'),
          ('criterion_assessment', ARRAY['CriterionAssessment_criterionId_fkey'], 'RubricAssessment_rubricId_fkey'),
          ('check_criterion', ARRAY['check_criterion_pkey'], 'boolean_rubric_pkey'),
          ('check_criterion', ARRAY['check_criterion_criterion_id_key'], 'boolean_rubric_rubric_id_key'),
          ('check_criterion', ARRAY['CheckCriterion_criterionId_fkey'], 'BooleanRubric_rubricId_fkey'),
          ('options_criterion', ARRAY['options_criterion_pkey'], 'ordinal_rubric_pkey'),
          ('options_criterion', ARRAY['options_criterion_criterion_id_key'], 'ordinal_rubric_rubric_id_key'),
          ('options_criterion', ARRAY['OptionsCriterion_criterionId_fkey'], 'OrdinalRubric_rubricId_fkey'),
          ('options_criterion_mark', ARRAY['options_criterion_mark_pkey'], 'ordinal_rubric_value_pkey'),
          ('options_criterion_mark', ARRAY['OptionsCriterionMark_optionsCriterionId_label_key'], 'OrdinalRubricValue_ordinalRubricId_label_key'),
          ('options_criterion_mark', ARRAY['OptionsCriterionMark_optionsCriterionId_fkey'], 'OrdinalRubricValue_ordinalRubricId_fkey'),
          ('number_criterion', ARRAY['number_criterion_pkey'], 'numerical_rubric_pkey'),
          ('number_criterion', ARRAY['number_criterion_criterion_id_key'], 'numerical_rubric_rubric_id_key'),
          ('number_criterion', ARRAY['number_criterion_marks_range_check'], 'numerical_rubric_marks_range_check'),
          ('number_criterion', ARRAY['number_criterion_score_range_check'], 'numerical_rubric_score_range_check'),
          ('number_criterion', ARRAY['NumberCriterion_criterionId_fkey'], 'NumericalRubric_rubricId_fkey'),
          ('check_criterion_assessment', ARRAY['check_criterion_assessment_pkey'], 'boolean_rubric_assessment_pkey'),
          ('check_criterion_assessment', ARRAY['check_criterion_assessment_criterion_assessment_id_key'], 'boolean_rubric_assessment_rubric_assessment_id_key'),
          ('check_criterion_assessment', ARRAY['CheckCriterionAssessment_criterionAssessmentId_fkey'], 'BooleanRubricAssessment_rubricAssessmentId_fkey'),
          ('options_criterion_assessment', ARRAY['options_criterion_assessment_pkey'], 'ordinal_rubric_assessment_pkey'),
          ('options_criterion_assessment', ARRAY['options_criterion_assessment_criterion_assessment_id_key'], 'ordinal_rubric_assessment_rubric_assessment_id_key'),
          ('options_criterion_assessment', ARRAY['OptionsCriterionAssessment_criterionAssessmentId_fkey'], 'OrdinalRubricAssessment_rubricAssessmentId_fkey'),
          ('number_criterion_assessment', ARRAY['number_criterion_assessment_pkey'], 'numerical_rubric_assessment_pkey'),
          ('number_criterion_assessment', ARRAY['number_criterion_assessment_criterion_assessment_id_key'], 'numerical_rubric_assessment_rubric_assessment_id_key'),
          ('number_criterion_assessment', ARRAY['NumberCriterionAssessment_criterionAssessmentId_fkey'], 'NumericalRubricAssessment_rubricAssessmentId_fkey')
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

    ALTER INDEX IF EXISTS "criterion_project_id_idx" RENAME TO "rubric_project_id_idx";
    -- 20260514000002 created this index verbatim via the schema builder
    -- (migration runners carry no name-transforming plugin), so this is its
    -- spelling before up().
    ALTER INDEX IF EXISTS "OptionsCriterionMark_optionsCriterionId_label_idx" RENAME TO "OrdinalRubricValue_ordinalRubricId_label_idx";
  `.execute(db);

	// Columns then tables back via the schema builder (sequential; see up()).
	for (const [table, from, to] of COLUMN_RENAMES) {
		await db.schema.alterTable(table).renameColumn(to, from).execute();
	}
	for (const [from, to] of TABLE_RENAMES) {
		await db.schema.alterTable(to).renameTo(from).execute();
	}

	// Enum back via the schema builder.
	await db.schema
		.alterType("criterion_kind")
		.renameValue("check", "boolean")
		.execute();
	await db.schema
		.alterType("criterion_kind")
		.renameValue("options", "ordinal")
		.execute();
	await db.schema
		.alterType("criterion_kind")
		.renameValue("number", "numerical")
		.execute();
	await db.schema.alterType("criterion_kind").renameTo("rubric_type").execute();

	// Restore prior enforcement functions and triggers (raw; no builder API).
	await sql`
    CREATE OR REPLACE FUNCTION enforce_boolean_rubric_type_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      rubric_type "rubric_type";
    BEGIN
      SELECT r.type INTO rubric_type
      FROM "rubric" r
      WHERE r.row_id = NEW."rubric_id";

      IF rubric_type IS NULL THEN
        RAISE EXCEPTION 'BooleanRubric references unknown Rubric row id: %', NEW."rubric_id";
      END IF;

      IF rubric_type <> 'boolean'::"rubric_type" THEN
        RAISE EXCEPTION 'BooleanRubric with rubricId % requires Rubric.type boolean, got %', NEW."rubric_id", rubric_type;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_ordinal_rubric_type_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      rubric_type "rubric_type";
    BEGIN
      SELECT r.type INTO rubric_type
      FROM "rubric" r
      WHERE r.row_id = NEW."rubric_id";

      IF rubric_type IS NULL THEN
        RAISE EXCEPTION 'OrdinalRubric references unknown Rubric row id: %', NEW."rubric_id";
      END IF;

      IF rubric_type <> 'ordinal'::"rubric_type" THEN
        RAISE EXCEPTION 'OrdinalRubric with rubricId % requires Rubric.type ordinal, got %', NEW."rubric_id", rubric_type;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_numerical_rubric_type_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      rubric_type "rubric_type";
    BEGIN
      SELECT r.type INTO rubric_type
      FROM "rubric" r
      WHERE r.row_id = NEW."rubric_id";

      IF rubric_type IS NULL THEN
        RAISE EXCEPTION 'NumericalRubric references unknown Rubric row id: %', NEW."rubric_id";
      END IF;

      IF rubric_type <> 'numerical'::"rubric_type" THEN
        RAISE EXCEPTION 'NumericalRubric with rubricId % requires Rubric.type numerical, got %', NEW."rubric_id", rubric_type;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_rubric_type_immutable()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    BEGIN
      IF NEW.type <> OLD.type THEN
        RAISE EXCEPTION 'Cannot change Rubric % type from % to %: Rubric.type is immutable', OLD.id, OLD.type, NEW.type;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_numerical_score_bounds()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      min_score numeric;
      max_score numeric;
    BEGIN
      SELECT nr.min_score, nr.max_score
      INTO min_score, max_score
      FROM "numerical_rubric" nr
      INNER JOIN "rubric_assessment" ra ON ra.rubric_id = nr.rubric_id
      WHERE ra.id = NEW.rubric_assessment_id;

      IF min_score IS NULL THEN
        RAISE EXCEPTION 'NumericalRubricAssessment % references no NumericalRubric', NEW.rubric_assessment_id;
      END IF;

      IF NEW.score < min_score OR NEW.score > max_score THEN
        RAISE EXCEPTION 'NumericalRubricAssessment score % is out of bounds [%, %]', NEW.score, min_score, max_score;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_ordinal_label_valid()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      label_exists boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM "rubric_assessment" ra
        INNER JOIN "ordinal_rubric" orub ON orub.rubric_id = ra.rubric_id
        INNER JOIN "ordinal_rubric_value" orv ON orv.ordinal_rubric_id = orub.id
        WHERE ra.id = NEW.rubric_assessment_id
          AND orv.label = NEW.selected_label
      ) INTO label_exists;

      IF NOT label_exists THEN
        RAISE EXCEPTION 'OrdinalRubricAssessment selected_label "%" is not a valid label for rubric_assessment %', NEW.selected_label, NEW.rubric_assessment_id;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE TRIGGER trg_boolean_rubric_type_match
    BEFORE INSERT OR UPDATE OF "rubric_id" ON "boolean_rubric"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_boolean_rubric_type_match();

    CREATE TRIGGER trg_ordinal_rubric_type_match
    BEFORE INSERT OR UPDATE OF "rubric_id" ON "ordinal_rubric"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ordinal_rubric_type_match();

    CREATE TRIGGER trg_numerical_rubric_type_match
    BEFORE INSERT OR UPDATE OF "rubric_id" ON "numerical_rubric"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_numerical_rubric_type_match();

    CREATE TRIGGER trg_rubric_type_immutable
    BEFORE UPDATE OF type ON "rubric"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_rubric_type_immutable();

    CREATE TRIGGER trg_numerical_score_bounds
    BEFORE INSERT OR UPDATE OF score, rubric_assessment_id ON "numerical_rubric_assessment"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_numerical_score_bounds();

    CREATE TRIGGER trg_ordinal_label_valid
    BEFORE INSERT OR UPDATE OF selected_label, rubric_assessment_id ON "ordinal_rubric_assessment"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ordinal_label_valid();
  `.execute(db);
}
