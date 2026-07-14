import { type Kysely, sql } from "kysely";

// Renames the retired "score" word to "value": `number_criterion.min_score`/
// `max_score` → `min_value`/`max_value`, and `number_criterion_grade.score` →
// `value`. A Number criterion can be reversed (higher input → fewer marks),
// where "score" reads as a good-thing tally but "value" stays correct (see
// CONTEXT.md: "Value").
//
// The CHECK constraint and the bounds-enforcement trigger/function do not
// auto-rename with their columns (their own identifiers are separate from the
// column attnum a column rename tracks — see
// docs/reference/database-migrations.md), so all four are renamed explicitly.
// The trigger function's body also names the old columns as plain text and
// must be rewritten, not just renamed.
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below is passed to Postgres verbatim and matches the live schema
// exactly. DDL runs one statement at a time (concurrent ALTER only contends
// for locks).

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.alterTable("number_criterion")
		.renameColumn("min_score", "min_value")
		.execute();
	await db.schema
		.alterTable("number_criterion")
		.renameColumn("max_score", "max_value")
		.execute();
	await db.schema
		.alterTable("number_criterion")
		.renameConstraint(
			"number_criterion_score_range_check",
			"number_criterion_value_range_check",
		)
		.execute();

	await sql`
    DROP TRIGGER IF EXISTS trg_number_criterion_score_bounds ON "number_criterion_grade";
  `.execute(db);
	await sql`
    DROP FUNCTION IF EXISTS enforce_number_criterion_score_bounds();
  `.execute(db);

	await db.schema
		.alterTable("number_criterion_grade")
		.renameColumn("score", "value")
		.execute();

	await sql`
    CREATE OR REPLACE FUNCTION enforce_number_criterion_value_bounds()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      min_value numeric;
      max_value numeric;
    BEGIN
      SELECT nc.min_value, nc.max_value
      INTO min_value, max_value
      FROM "number_criterion" nc
      INNER JOIN "criterion_grade" cg ON cg.criterion_id = nc.criterion_id
      WHERE cg.id = NEW.criterion_grade_id;

      IF min_value IS NULL THEN
        RAISE EXCEPTION 'NumberCriterionGrade % references no NumberCriterion', NEW.criterion_grade_id;
      END IF;

      IF NEW.value < min_value OR NEW.value > max_value THEN
        RAISE EXCEPTION 'NumberCriterionGrade value % is out of bounds [%, %]', NEW.value, min_value, max_value;
      END IF;

      RETURN NEW;
    END;
    $$;
  `.execute(db);
	await sql`
    CREATE TRIGGER trg_number_criterion_value_bounds
    BEFORE INSERT OR UPDATE OF value, criterion_grade_id ON "number_criterion_grade"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_number_criterion_value_bounds();
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`
    DROP TRIGGER IF EXISTS trg_number_criterion_value_bounds ON "number_criterion_grade";
  `.execute(db);
	await sql`
    DROP FUNCTION IF EXISTS enforce_number_criterion_value_bounds();
  `.execute(db);

	await db.schema
		.alterTable("number_criterion_grade")
		.renameColumn("value", "score")
		.execute();

	await sql`
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
    $$;
  `.execute(db);
	await sql`
    CREATE TRIGGER trg_number_criterion_score_bounds
    BEFORE INSERT OR UPDATE OF score, criterion_grade_id ON "number_criterion_grade"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_number_criterion_score_bounds();
  `.execute(db);

	await db.schema
		.alterTable("number_criterion")
		.renameConstraint(
			"number_criterion_value_range_check",
			"number_criterion_score_range_check",
		)
		.execute();
	await db.schema
		.alterTable("number_criterion")
		.renameColumn("max_value", "max_score")
		.execute();
	await db.schema
		.alterTable("number_criterion")
		.renameColumn("min_value", "min_score")
		.execute();
}
