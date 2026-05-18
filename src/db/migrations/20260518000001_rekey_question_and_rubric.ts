import { type Generated, type Kysely, sql } from "kysely";

type MigrationDB = {
  assessment: {
    id: Generated<number>;
    project_id: number;
    question_id: string | number;
    submission_id: number;
  };
  boolean_rubric: {
    id: Generated<number>;
    rubric_id: string | number;
  };
  numerical_rubric: {
    id: Generated<number>;
    rubric_id: string | number;
  };
  ordinal_rubric: {
    id: Generated<number>;
    rubric_id: string | number;
  };
  question: {
    id: string;
    project_id: number;
    row_id: Generated<number>;
  };
  rubric: {
    id: string;
    project_id: number;
    question_id: string | number;
    row_id: Generated<number>;
  };
  rubric_assessment: {
    assessment_id: number;
    id: Generated<number>;
    rubric_id: string | number;
  };
};

export async function up(db: Kysely<MigrationDB>): Promise<void> {
  const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'question'
        AND column_name = 'row_id'
    ) AS exists
  `.execute(db);

  if (rows[0]?.exists) {
    return;
  }

  await db.schema
    .alterTable("question")
    .addColumn("row_id", "integer", (col) =>
      col.generatedAlwaysAsIdentity().notNull(),
    )
    .execute();

  await db.schema
    .alterTable("rubric")
    .addColumn("row_id", "integer", (col) =>
      col.generatedAlwaysAsIdentity().notNull(),
    )
    .execute();

  // Raw SQL is used here because this migration performs an atomic FK/PK
  // transition with data backfill across multiple dependent tables.
  await sql`
    ALTER TABLE "rubric"
    ADD COLUMN "question_row_id" INTEGER;

    ALTER TABLE "assessment"
    ADD COLUMN "question_row_id" INTEGER;

    ALTER TABLE "rubric_assessment"
    ADD COLUMN "rubric_row_id" INTEGER;

    ALTER TABLE "boolean_rubric"
    ADD COLUMN "rubric_row_id" INTEGER;

    ALTER TABLE "ordinal_rubric"
    ADD COLUMN "rubric_row_id" INTEGER;

    ALTER TABLE "numerical_rubric"
    ADD COLUMN "rubric_row_id" INTEGER;

    UPDATE "rubric" r
    SET "question_row_id" = q."row_id"
    FROM "question" q
    WHERE q."id" = r."question_id"
      AND q."project_id" = r."project_id";

    UPDATE "assessment" a
    SET "question_row_id" = q."row_id"
    FROM "question" q
    WHERE q."id" = a."question_id"
      AND q."project_id" = a."project_id";

    UPDATE "rubric_assessment" ra
    SET "rubric_row_id" = r."row_id"
    FROM "rubric" r, "assessment" a
    WHERE a."id" = ra."assessment_id"
      AND r."id" = ra."rubric_id"
      AND r."project_id" = a."project_id";

    UPDATE "boolean_rubric" br
    SET "rubric_row_id" = r."row_id"
    FROM "rubric" r
    WHERE r."id" = br."rubric_id";

    UPDATE "ordinal_rubric" ord
    SET "rubric_row_id" = r."row_id"
    FROM "rubric" r
    WHERE r."id" = ord."rubric_id";

    UPDATE "numerical_rubric" nr
    SET "rubric_row_id" = r."row_id"
    FROM "rubric" r
    WHERE r."id" = nr."rubric_id";

    DROP TRIGGER IF EXISTS trg_numerical_rubric_type_match ON "numerical_rubric";
    DROP TRIGGER IF EXISTS trg_ordinal_rubric_type_match ON "ordinal_rubric";
    DROP TRIGGER IF EXISTS trg_boolean_rubric_type_match ON "boolean_rubric";

    DROP FUNCTION IF EXISTS enforce_numerical_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_ordinal_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_boolean_rubric_type_match();

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "Rubric_questionId_fkey";

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "Rubric_questionId_position_key";

    ALTER TABLE "assessment"
    DROP CONSTRAINT IF EXISTS "Assessment_questionId_fkey";

    ALTER TABLE "assessment"
    DROP CONSTRAINT IF EXISTS "Assessment_submissionId_questionId_key";

    ALTER TABLE "rubric_assessment"
    DROP CONSTRAINT IF EXISTS "RubricAssessment_rubricId_fkey";

    ALTER TABLE "rubric_assessment"
    DROP CONSTRAINT IF EXISTS "RubricAssessment_assessmentId_rubricId_key";

    ALTER TABLE "boolean_rubric"
    DROP CONSTRAINT IF EXISTS "BooleanRubric_rubricId_fkey";

    ALTER TABLE "ordinal_rubric"
    DROP CONSTRAINT IF EXISTS "OrdinalRubric_rubricId_fkey";

    ALTER TABLE "numerical_rubric"
    DROP CONSTRAINT IF EXISTS "NumericalRubric_rubricId_fkey";

    ALTER TABLE "boolean_rubric"
    DROP CONSTRAINT IF EXISTS "boolean_rubric_rubric_id_key";

    ALTER TABLE "ordinal_rubric"
    DROP CONSTRAINT IF EXISTS "ordinal_rubric_rubric_id_key";

    ALTER TABLE "numerical_rubric"
    DROP CONSTRAINT IF EXISTS "numerical_rubric_rubric_id_key";

    ALTER TABLE "question"
    DROP CONSTRAINT IF EXISTS "question_pkey" CASCADE;

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "rubric_pkey" CASCADE;

    ALTER TABLE "rubric"
    DROP COLUMN "question_id";

    ALTER TABLE "assessment"
    DROP COLUMN "question_id";

    ALTER TABLE "rubric_assessment"
    DROP COLUMN "rubric_id";

    ALTER TABLE "boolean_rubric"
    DROP COLUMN "rubric_id";

    ALTER TABLE "ordinal_rubric"
    DROP COLUMN "rubric_id";

    ALTER TABLE "numerical_rubric"
    DROP COLUMN "rubric_id";

    ALTER TABLE "rubric"
    RENAME COLUMN "question_row_id" TO "question_id";

    ALTER TABLE "assessment"
    RENAME COLUMN "question_row_id" TO "question_id";

    ALTER TABLE "rubric_assessment"
    RENAME COLUMN "rubric_row_id" TO "rubric_id";

    ALTER TABLE "boolean_rubric"
    RENAME COLUMN "rubric_row_id" TO "rubric_id";

    ALTER TABLE "ordinal_rubric"
    RENAME COLUMN "rubric_row_id" TO "rubric_id";

    ALTER TABLE "numerical_rubric"
    RENAME COLUMN "rubric_row_id" TO "rubric_id";

    ALTER TABLE "rubric"
    ALTER COLUMN "question_id" SET NOT NULL;

    ALTER TABLE "assessment"
    ALTER COLUMN "question_id" SET NOT NULL;

    ALTER TABLE "rubric_assessment"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "boolean_rubric"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "ordinal_rubric"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "numerical_rubric"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "question"
    ADD CONSTRAINT "question_pkey" PRIMARY KEY ("row_id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "rubric_pkey" PRIMARY KEY ("row_id");

    ALTER TABLE "question"
    ADD CONSTRAINT "Question_projectId_id_key" UNIQUE ("project_id", "id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "Rubric_projectId_id_key" UNIQUE ("project_id", "id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "Rubric_questionId_position_key" UNIQUE ("question_id", "position");

    ALTER TABLE "assessment"
    ADD CONSTRAINT "Assessment_submissionId_questionId_key" UNIQUE ("submission_id", "question_id");

    ALTER TABLE "rubric_assessment"
    ADD CONSTRAINT "RubricAssessment_assessmentId_rubricId_key" UNIQUE ("assessment_id", "rubric_id");

    ALTER TABLE "boolean_rubric"
    ADD CONSTRAINT "boolean_rubric_rubric_id_key" UNIQUE ("rubric_id");

    ALTER TABLE "ordinal_rubric"
    ADD CONSTRAINT "ordinal_rubric_rubric_id_key" UNIQUE ("rubric_id");

    ALTER TABLE "numerical_rubric"
    ADD CONSTRAINT "numerical_rubric_rubric_id_key" UNIQUE ("rubric_id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "Rubric_questionId_fkey"
    FOREIGN KEY ("question_id")
    REFERENCES "question" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "assessment"
    ADD CONSTRAINT "Assessment_questionId_fkey"
    FOREIGN KEY ("question_id")
    REFERENCES "question" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "rubric_assessment"
    ADD CONSTRAINT "RubricAssessment_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "boolean_rubric"
    ADD CONSTRAINT "BooleanRubric_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "ordinal_rubric"
    ADD CONSTRAINT "OrdinalRubric_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "numerical_rubric"
    ADD CONSTRAINT "NumericalRubric_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

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
  `.execute(db);
}

export async function down(db: Kysely<MigrationDB>): Promise<void> {
  // Raw SQL mirrors the forward rekey operations in reverse for rollback.
  await sql`
    DROP TRIGGER IF EXISTS trg_numerical_rubric_type_match ON "numerical_rubric";
    DROP TRIGGER IF EXISTS trg_ordinal_rubric_type_match ON "ordinal_rubric";
    DROP TRIGGER IF EXISTS trg_boolean_rubric_type_match ON "boolean_rubric";

    DROP FUNCTION IF EXISTS enforce_numerical_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_ordinal_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_boolean_rubric_type_match();

    ALTER TABLE "rubric"
    ADD COLUMN "question_id_text" TEXT;

    ALTER TABLE "assessment"
    ADD COLUMN "question_id_text" TEXT;

    ALTER TABLE "rubric_assessment"
    ADD COLUMN "rubric_id_text" TEXT;

    ALTER TABLE "boolean_rubric"
    ADD COLUMN "rubric_id_text" TEXT;

    ALTER TABLE "ordinal_rubric"
    ADD COLUMN "rubric_id_text" TEXT;

    ALTER TABLE "numerical_rubric"
    ADD COLUMN "rubric_id_text" TEXT;

    UPDATE "rubric" r
    SET "question_id_text" = q."id"
    FROM "question" q
    WHERE q."row_id" = r."question_id";

    UPDATE "assessment" a
    SET "question_id_text" = q."id"
    FROM "question" q
    WHERE q."row_id" = a."question_id";

    UPDATE "rubric_assessment" ra
    SET "rubric_id_text" = r."id"
    FROM "rubric" r
    WHERE r."row_id" = ra."rubric_id";

    UPDATE "boolean_rubric" br
    SET "rubric_id_text" = r."id"
    FROM "rubric" r
    WHERE r."row_id" = br."rubric_id";

    UPDATE "ordinal_rubric" ord
    SET "rubric_id_text" = r."id"
    FROM "rubric" r
    WHERE r."row_id" = ord."rubric_id";

    UPDATE "numerical_rubric" nr
    SET "rubric_id_text" = r."id"
    FROM "rubric" r
    WHERE r."row_id" = nr."rubric_id";

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "Rubric_questionId_fkey";

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "Rubric_questionId_position_key";

    ALTER TABLE "assessment"
    DROP CONSTRAINT IF EXISTS "Assessment_questionId_fkey";

    ALTER TABLE "assessment"
    DROP CONSTRAINT IF EXISTS "Assessment_submissionId_questionId_key";

    ALTER TABLE "rubric_assessment"
    DROP CONSTRAINT IF EXISTS "RubricAssessment_rubricId_fkey";

    ALTER TABLE "rubric_assessment"
    DROP CONSTRAINT IF EXISTS "RubricAssessment_assessmentId_rubricId_key";

    ALTER TABLE "boolean_rubric"
    DROP CONSTRAINT IF EXISTS "BooleanRubric_rubricId_fkey";

    ALTER TABLE "ordinal_rubric"
    DROP CONSTRAINT IF EXISTS "OrdinalRubric_rubricId_fkey";

    ALTER TABLE "numerical_rubric"
    DROP CONSTRAINT IF EXISTS "NumericalRubric_rubricId_fkey";

    ALTER TABLE "boolean_rubric"
    DROP CONSTRAINT IF EXISTS "boolean_rubric_rubric_id_key";

    ALTER TABLE "ordinal_rubric"
    DROP CONSTRAINT IF EXISTS "ordinal_rubric_rubric_id_key";

    ALTER TABLE "numerical_rubric"
    DROP CONSTRAINT IF EXISTS "numerical_rubric_rubric_id_key";

    ALTER TABLE "question"
    DROP CONSTRAINT IF EXISTS "Question_projectId_id_key";

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "Rubric_projectId_id_key";

    ALTER TABLE "question"
    DROP CONSTRAINT IF EXISTS "question_pkey" CASCADE;

    ALTER TABLE "rubric"
    DROP CONSTRAINT IF EXISTS "rubric_pkey" CASCADE;

    ALTER TABLE "rubric"
    DROP COLUMN "question_id";

    ALTER TABLE "assessment"
    DROP COLUMN "question_id";

    ALTER TABLE "rubric_assessment"
    DROP COLUMN "rubric_id";

    ALTER TABLE "boolean_rubric"
    DROP COLUMN "rubric_id";

    ALTER TABLE "ordinal_rubric"
    DROP COLUMN "rubric_id";

    ALTER TABLE "numerical_rubric"
    DROP COLUMN "rubric_id";

    ALTER TABLE "rubric"
    RENAME COLUMN "question_id_text" TO "question_id";

    ALTER TABLE "assessment"
    RENAME COLUMN "question_id_text" TO "question_id";

    ALTER TABLE "rubric_assessment"
    RENAME COLUMN "rubric_id_text" TO "rubric_id";

    ALTER TABLE "boolean_rubric"
    RENAME COLUMN "rubric_id_text" TO "rubric_id";

    ALTER TABLE "ordinal_rubric"
    RENAME COLUMN "rubric_id_text" TO "rubric_id";

    ALTER TABLE "numerical_rubric"
    RENAME COLUMN "rubric_id_text" TO "rubric_id";

    ALTER TABLE "rubric"
    ALTER COLUMN "question_id" SET NOT NULL;

    ALTER TABLE "assessment"
    ALTER COLUMN "question_id" SET NOT NULL;

    ALTER TABLE "rubric_assessment"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "boolean_rubric"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "ordinal_rubric"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "numerical_rubric"
    ALTER COLUMN "rubric_id" SET NOT NULL;

    ALTER TABLE "question"
    ADD CONSTRAINT "question_pkey" PRIMARY KEY ("id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "rubric_pkey" PRIMARY KEY ("id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "Rubric_questionId_position_key" UNIQUE ("question_id", "position");

    ALTER TABLE "assessment"
    ADD CONSTRAINT "Assessment_submissionId_questionId_key" UNIQUE ("submission_id", "question_id");

    ALTER TABLE "rubric_assessment"
    ADD CONSTRAINT "RubricAssessment_assessmentId_rubricId_key" UNIQUE ("assessment_id", "rubric_id");

    ALTER TABLE "boolean_rubric"
    ADD CONSTRAINT "boolean_rubric_rubric_id_key" UNIQUE ("rubric_id");

    ALTER TABLE "ordinal_rubric"
    ADD CONSTRAINT "ordinal_rubric_rubric_id_key" UNIQUE ("rubric_id");

    ALTER TABLE "numerical_rubric"
    ADD CONSTRAINT "numerical_rubric_rubric_id_key" UNIQUE ("rubric_id");

    ALTER TABLE "rubric"
    ADD CONSTRAINT "Rubric_questionId_fkey"
    FOREIGN KEY ("question_id")
    REFERENCES "question" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "assessment"
    ADD CONSTRAINT "Assessment_questionId_fkey"
    FOREIGN KEY ("question_id")
    REFERENCES "question" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "rubric_assessment"
    ADD CONSTRAINT "RubricAssessment_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "boolean_rubric"
    ADD CONSTRAINT "BooleanRubric_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "ordinal_rubric"
    ADD CONSTRAINT "OrdinalRubric_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "numerical_rubric"
    ADD CONSTRAINT "NumericalRubric_rubricId_fkey"
    FOREIGN KEY ("rubric_id")
    REFERENCES "rubric" ("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    CREATE OR REPLACE FUNCTION enforce_boolean_rubric_type_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      rubric_type "rubric_type";
    BEGIN
      SELECT r.type INTO rubric_type
      FROM "rubric" r
      WHERE r.id = NEW."rubric_id";

      IF rubric_type IS NULL THEN
        RAISE EXCEPTION 'BooleanRubric references unknown Rubric id: %', NEW."rubric_id";
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
      WHERE r.id = NEW."rubric_id";

      IF rubric_type IS NULL THEN
        RAISE EXCEPTION 'OrdinalRubric references unknown Rubric id: %', NEW."rubric_id";
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
      WHERE r.id = NEW."rubric_id";

      IF rubric_type IS NULL THEN
        RAISE EXCEPTION 'NumericalRubric references unknown Rubric id: %', NEW."rubric_id";
      END IF;

      IF rubric_type <> 'numerical'::"rubric_type" THEN
        RAISE EXCEPTION 'NumericalRubric with rubricId % requires Rubric.type numerical, got %', NEW."rubric_id", rubric_type;
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

    ALTER TABLE "question"
    DROP COLUMN "row_id";

    ALTER TABLE "rubric"
    DROP COLUMN "row_id";
  `.execute(db);
}
