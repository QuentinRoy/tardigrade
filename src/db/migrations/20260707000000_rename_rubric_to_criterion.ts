import { type Kysely, sql } from "kysely";

// Terminology sweep stage 2a: the leaf gradeable item is renamed Rubric ->
// Criterion, with the criterion-kind rename folded in (boolean/ordinal/numerical
// -> check/options/number). The subtype tables go straight to their final names
// in one hop. The container `question` and the assess axis (`assessment`,
// `rubric_assessment` -> here `criterion_assessment` keeps the "assessment" word)
// are handled by later stages; `question_id` on `criterion`/`assessment` and the
// score/value columns are intentionally left for stages 2b and 7b.

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
    -- Drop triggers and functions; recreated at the end with new names/bodies.
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

    -- Enum type and values.
    ALTER TYPE "rubric_type" RENAME TO "criterion_kind";
    ALTER TYPE "criterion_kind" RENAME VALUE 'boolean' TO 'check';
    ALTER TYPE "criterion_kind" RENAME VALUE 'ordinal' TO 'options';
    ALTER TYPE "criterion_kind" RENAME VALUE 'numerical' TO 'number';

    -- Tables.
    ALTER TABLE "rubric" RENAME TO "criterion";
    ALTER TABLE "boolean_rubric" RENAME TO "check_criterion";
    ALTER TABLE "ordinal_rubric" RENAME TO "options_criterion";
    ALTER TABLE "ordinal_rubric_value" RENAME TO "options_criterion_mark";
    ALTER TABLE "numerical_rubric" RENAME TO "number_criterion";
    ALTER TABLE "rubric_assessment" RENAME TO "criterion_assessment";
    ALTER TABLE "boolean_rubric_assessment" RENAME TO "check_criterion_assessment";
    ALTER TABLE "ordinal_rubric_assessment" RENAME TO "options_criterion_assessment";
    ALTER TABLE "numerical_rubric_assessment" RENAME TO "number_criterion_assessment";

    -- Columns: kind classifier and leaf foreign keys.
    ALTER TABLE "criterion" RENAME COLUMN "type" TO "kind";
    ALTER TABLE "criterion_assessment" RENAME COLUMN "type" TO "kind";
    ALTER TABLE "criterion_assessment" RENAME COLUMN "rubric_id" TO "criterion_id";
    ALTER TABLE "check_criterion" RENAME COLUMN "rubric_id" TO "criterion_id";
    ALTER TABLE "options_criterion" RENAME COLUMN "rubric_id" TO "criterion_id";
    ALTER TABLE "number_criterion" RENAME COLUMN "rubric_id" TO "criterion_id";
    ALTER TABLE "options_criterion_mark" RENAME COLUMN "ordinal_rubric_id" TO "options_criterion_id";
    ALTER TABLE "check_criterion_assessment" RENAME COLUMN "rubric_assessment_id" TO "criterion_assessment_id";
    ALTER TABLE "options_criterion_assessment" RENAME COLUMN "rubric_assessment_id" TO "criterion_assessment_id";
    ALTER TABLE "number_criterion_assessment" RENAME COLUMN "rubric_assessment_id" TO "criterion_assessment_id";

    -- Constraint and index identifiers are intentionally left unchanged. They
    -- are never referenced by app code, and their exact spelling differs by
    -- migration runner: earlier schema-builder constraints are snake_cased by
    -- the test runner's CamelCasePlugin (e.g. "Rubric_projectId_fkey" ->
    -- rubric_project_id_fkey) but kept verbatim by the plain prod runner. A raw
    -- ALTER ... RENAME CONSTRAINT by hard-coded name would therefore succeed in
    -- one environment and fail in the other. Renaming them for cosmetics is not
    -- worth that fragility, so only tables, columns, the enum, and triggers move.

    -- Recreate kind-match, immutability, bounds, and label-valid enforcement.
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

    -- Columns.
    ALTER TABLE "criterion" RENAME COLUMN "kind" TO "type";
    ALTER TABLE "criterion_assessment" RENAME COLUMN "kind" TO "type";
    ALTER TABLE "criterion_assessment" RENAME COLUMN "criterion_id" TO "rubric_id";
    ALTER TABLE "check_criterion" RENAME COLUMN "criterion_id" TO "rubric_id";
    ALTER TABLE "options_criterion" RENAME COLUMN "criterion_id" TO "rubric_id";
    ALTER TABLE "number_criterion" RENAME COLUMN "criterion_id" TO "rubric_id";
    ALTER TABLE "options_criterion_mark" RENAME COLUMN "options_criterion_id" TO "ordinal_rubric_id";
    ALTER TABLE "check_criterion_assessment" RENAME COLUMN "criterion_assessment_id" TO "rubric_assessment_id";
    ALTER TABLE "options_criterion_assessment" RENAME COLUMN "criterion_assessment_id" TO "rubric_assessment_id";
    ALTER TABLE "number_criterion_assessment" RENAME COLUMN "criterion_assessment_id" TO "rubric_assessment_id";

    -- Tables.
    ALTER TABLE "criterion" RENAME TO "rubric";
    ALTER TABLE "check_criterion" RENAME TO "boolean_rubric";
    ALTER TABLE "options_criterion" RENAME TO "ordinal_rubric";
    ALTER TABLE "options_criterion_mark" RENAME TO "ordinal_rubric_value";
    ALTER TABLE "number_criterion" RENAME TO "numerical_rubric";
    ALTER TABLE "criterion_assessment" RENAME TO "rubric_assessment";
    ALTER TABLE "check_criterion_assessment" RENAME TO "boolean_rubric_assessment";
    ALTER TABLE "options_criterion_assessment" RENAME TO "ordinal_rubric_assessment";
    ALTER TABLE "number_criterion_assessment" RENAME TO "numerical_rubric_assessment";

    -- Enum values and type.
    ALTER TYPE "criterion_kind" RENAME VALUE 'check' TO 'boolean';
    ALTER TYPE "criterion_kind" RENAME VALUE 'options' TO 'ordinal';
    ALTER TYPE "criterion_kind" RENAME VALUE 'number' TO 'numerical';
    ALTER TYPE "criterion_kind" RENAME TO "rubric_type";

    -- Restore prior enforcement functions and triggers.
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
