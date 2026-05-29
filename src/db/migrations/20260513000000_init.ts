import { type Kysely, sql } from "kysely";

export async function up(db: Kysely<unknown>): Promise<void> {
	await sql`
    CREATE TYPE "rubric_type" AS ENUM ('boolean', 'ordinal', 'numerical');
    CREATE TYPE "submission_type" AS ENUM ('individual', 'team');
  `.execute(db);

	await db.schema
		.createTable("team")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("name", "text", (column) => column.notNull().unique())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.execute();

	await db.schema
		.createTable("student")
		.addColumn("id", "text", (column) => column.primaryKey().notNull())
		.addColumn("family_name", "text", (column) => column.notNull())
		.addColumn("first_name", "text", (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.execute();

	await db.schema
		.createTable("submission")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("type", sql`"submission_type"`, (column) =>
			column.notNull().defaultTo("individual"),
		)
		.addColumn("team_id", "integer")
		.addColumn("student_id", "text")
		.addForeignKeyConstraint(
			"Submission_teamId_fkey",
			["team_id"],
			"team",
			["id"],
			(constraint) => constraint.onDelete("set null").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"Submission_studentId_fkey",
			["student_id"],
			"student",
			["id"],
			(constraint) => constraint.onDelete("set null").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("student_to_team")
		.addColumn("student_id", "text", (column) => column.notNull())
		.addColumn("team_id", "integer", (column) => column.notNull())
		.addPrimaryKeyConstraint("StudentToTeam_studentId_teamId_pkey", [
			"student_id",
			"team_id",
		])
		.addForeignKeyConstraint(
			"StudentToTeam_studentId_fkey",
			["student_id"],
			"student",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"StudentToTeam_teamId_fkey",
			["team_id"],
			"team",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("StudentToTeam_teamId_index")
		.on("student_to_team")
		.column("team_id")
		.execute();

	await db.schema
		.createTable("question")
		.addColumn("id", "text", (column) => column.primaryKey().notNull())
		.addColumn("label", "text")
		.addColumn("position", "integer", (column) => column.notNull().defaultTo(0))
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.execute();

	await db.schema
		.createTable("rubric")
		.addColumn("id", "text", (column) => column.primaryKey().notNull())
		.addColumn("question_id", "text", (column) => column.notNull())
		.addColumn("position", "integer", (column) => column.notNull())
		.addColumn("description", "text")
		.addColumn("label", "text")
		.addColumn("type", sql`"rubric_type"`, (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addUniqueConstraint("Rubric_questionId_position_key", [
			"question_id",
			"position",
		])
		.addForeignKeyConstraint(
			"Rubric_questionId_fkey",
			["question_id"],
			"question",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("boolean_rubric")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("rubric_id", "text", (column) => column.notNull().unique())
		.addColumn("marks", "numeric(10, 2)", (column) => column.notNull())
		.addForeignKeyConstraint(
			"BooleanRubric_rubricId_fkey",
			["rubric_id"],
			"rubric",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("ordinal_rubric")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("rubric_id", "text", (column) => column.notNull().unique())
		.addForeignKeyConstraint(
			"OrdinalRubric_rubricId_fkey",
			["rubric_id"],
			"rubric",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("ordinal_rubric_value")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("ordinal_rubric_id", "integer", (column) => column.notNull())
		.addColumn("label", "text", (column) => column.notNull())
		.addColumn("marks", "numeric(10, 2)", (column) => column.notNull())
		.addUniqueConstraint("OrdinalRubricValue_ordinalRubricId_label_key", [
			"ordinal_rubric_id",
			"label",
		])
		.addForeignKeyConstraint(
			"OrdinalRubricValue_ordinalRubricId_fkey",
			["ordinal_rubric_id"],
			"ordinal_rubric",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("OrdinalRubricValue_ordinalRubricId_idx")
		.on("ordinal_rubric_value")
		.column("ordinal_rubric_id")
		.execute();

	await db.schema
		.createTable("numerical_rubric")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("rubric_id", "text", (column) => column.notNull().unique())
		.addColumn("min_score", "numeric(10, 2)", (column) => column.notNull())
		.addColumn("max_score", "numeric(10, 2)", (column) => column.notNull())
		.addColumn("min_marks", "numeric(10, 2)", (column) => column.notNull())
		.addColumn("max_marks", "numeric(10, 2)", (column) => column.notNull())
		.addForeignKeyConstraint(
			"NumericalRubric_rubricId_fkey",
			["rubric_id"],
			"rubric",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("assessment")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("submission_id", "integer", (column) => column.notNull())
		.addColumn("question_id", "text", (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addUniqueConstraint("Assessment_submissionId_questionId_key", [
			"submission_id",
			"question_id",
		])
		.addForeignKeyConstraint(
			"Assessment_submissionId_fkey",
			["submission_id"],
			"submission",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"Assessment_questionId_fkey",
			["question_id"],
			"question",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("rubric_assessment")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("assessment_id", "integer", (column) => column.notNull())
		.addColumn("rubric_id", "text", (column) => column.notNull())
		.addColumn("type", sql`"rubric_type"`, (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addUniqueConstraint("RubricAssessment_assessmentId_rubricId_key", [
			"assessment_id",
			"rubric_id",
		])
		.addForeignKeyConstraint(
			"RubricAssessment_assessmentId_fkey",
			["assessment_id"],
			"assessment",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"RubricAssessment_rubricId_fkey",
			["rubric_id"],
			"rubric",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("boolean_rubric_assessment")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("rubric_assessment_id", "integer", (column) =>
			column.notNull().unique(),
		)
		.addColumn("passed", "boolean", (column) => column.notNull())
		.addForeignKeyConstraint(
			"BooleanRubricAssessment_rubricAssessmentId_fkey",
			["rubric_assessment_id"],
			"rubric_assessment",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("ordinal_rubric_assessment")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("rubric_assessment_id", "integer", (column) =>
			column.notNull().unique(),
		)
		.addColumn("selected_label", "text", (column) => column.notNull())
		.addForeignKeyConstraint(
			"OrdinalRubricAssessment_rubricAssessmentId_fkey",
			["rubric_assessment_id"],
			"rubric_assessment",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createTable("numerical_rubric_assessment")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("rubric_assessment_id", "integer", (column) =>
			column.notNull().unique(),
		)
		.addColumn("score", "numeric(10, 6)", (column) => column.notNull())
		.addForeignKeyConstraint(
			"NumericalRubricAssessment_rubricAssessmentId_fkey",
			["rubric_assessment_id"],
			"rubric_assessment",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("Submission_teamId_key")
		.unique()
		.on("submission")
		.column("team_id")
		.execute();

	await db.schema
		.createIndex("Submission_studentId_key")
		.unique()
		.on("submission")
		.column("student_id")
		.execute();

	await sql`
    ALTER TABLE "submission"
    ADD CONSTRAINT "Submission_type_participant_check"
    CHECK (
      (
        "type" = 'individual'::"submission_type"
        AND "student_id" IS NOT NULL
        AND "team_id" IS NULL
      )
      OR
      (
        "type" = 'team'::"submission_type"
        AND "team_id" IS NOT NULL
        AND "student_id" IS NULL
      )
    );

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
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await sql`
    DROP TRIGGER IF EXISTS trg_rubric_type_immutable ON "rubric";
    DROP TRIGGER IF EXISTS trg_numerical_rubric_type_match ON "numerical_rubric";
    DROP TRIGGER IF EXISTS trg_ordinal_rubric_type_match ON "ordinal_rubric";
    DROP TRIGGER IF EXISTS trg_boolean_rubric_type_match ON "boolean_rubric";

    DROP FUNCTION IF EXISTS enforce_rubric_type_immutable();
    DROP FUNCTION IF EXISTS enforce_numerical_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_ordinal_rubric_type_match();
    DROP FUNCTION IF EXISTS enforce_boolean_rubric_type_match();
  `.execute(db);

	await db.schema.dropTable("numerical_rubric_assessment").ifExists().execute();
	await db.schema.dropTable("ordinal_rubric_assessment").ifExists().execute();
	await db.schema.dropTable("boolean_rubric_assessment").ifExists().execute();
	await db.schema.dropTable("rubric_assessment").ifExists().execute();
	await db.schema.dropTable("assessment").ifExists().execute();
	await db.schema.dropTable("numerical_rubric").ifExists().execute();
	await db.schema.dropTable("ordinal_rubric_value").ifExists().execute();
	await db.schema.dropTable("ordinal_rubric").ifExists().execute();
	await db.schema.dropTable("boolean_rubric").ifExists().execute();
	await db.schema.dropTable("rubric").ifExists().execute();
	await db.schema.dropTable("question").ifExists().execute();
	await db.schema.dropTable("student_to_team").ifExists().execute();
	await db.schema.dropTable("submission").ifExists().execute();
	await db.schema.dropTable("student").ifExists().execute();
	await db.schema.dropTable("team").ifExists().execute();

	await sql`
    DROP TYPE IF EXISTS "submission_type";
    DROP TYPE IF EXISTS "rubric_type";
  `.execute(db);
}
