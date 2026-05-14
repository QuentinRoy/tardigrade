import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`
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

    CREATE TRIGGER trg_numerical_score_bounds
    BEFORE INSERT OR UPDATE OF score, rubric_assessment_id ON "numerical_rubric_assessment"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_numerical_score_bounds();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`
    DROP TRIGGER IF EXISTS trg_numerical_score_bounds ON "numerical_rubric_assessment";
    DROP FUNCTION IF EXISTS enforce_numerical_score_bounds();
  `.execute(db);
}
