import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
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

    CREATE TRIGGER trg_ordinal_label_valid
    BEFORE INSERT OR UPDATE OF selected_label, rubric_assessment_id ON "ordinal_rubric_assessment"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_ordinal_label_valid();
  `.execute(db);

	await db.schema.dropIndex("OrdinalRubricValue_ordinalRubricId_idx").execute();

	await db.schema
		.createIndex("OrdinalRubricValue_ordinalRubricId_label_idx")
		.on("ordinal_rubric_value")
		.columns(["ordinal_rubric_id", "label"])
		.execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`
    DROP TRIGGER IF EXISTS trg_ordinal_label_valid ON "ordinal_rubric_assessment";
    DROP FUNCTION IF EXISTS enforce_ordinal_label_valid();
  `.execute(db);

	await db.schema
		.dropIndex("OrdinalRubricValue_ordinalRubricId_label_idx")
		.execute();

	await db.schema
		.createIndex("OrdinalRubricValue_ordinalRubricId_idx")
		.on("ordinal_rubric_value")
		.columns(["ordinal_rubric_id"])
		.execute();
}
