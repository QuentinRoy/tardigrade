import { type Kysely, sql } from "kysely";

/**
 * Data migration to introduce student.row_id as the primary key
 * and convert student_id FK columns from TEXT to INTEGER.
 *
 * Original schema had:
 *   student(id TEXT PK, ...)
 *   submission.student_id TEXT -> student.id
 *   student_to_team(student_id TEXT, team_id INT, PK on both)
 *
 * Target schema:
 *   student(row_id INT PK, id TEXT, ...)
 *   submission.student_id INT -> student.row_id
 *   student_to_team(student_id INT, team_id INT, PK on both)
 *
 * Uses raw SQL for complex constraint and column type migrations
 * that cannot be cleanly expressed with Kysely's schema builder.
 */

export async function up(db: Kysely<unknown>): Promise<void> {
	// If student.row_id already exists, this DB was initialized from the bad init
	// migration (fa6f8c8e) and is already in the target state. Skip.
	const { rows } = await sql<{ exists: boolean }>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'student'
        AND column_name = 'row_id'
    ) AS exists
  `.execute(db);

	if (rows[0]?.exists) {
		return;
	}

	// Step 1: Add row_id to student as an auto-increment column (not PK yet).
	// PostgreSQL auto-populates existing rows with sequential values starting from 1.
	await db.schema
		.alterTable("student")
		.addColumn("row_id", "integer", (col) =>
			col.generatedAlwaysAsIdentity().notNull(),
		)
		.execute();

	// Step 2+: Perform the complex restructuring with raw SQL.
	// This is justified because:
	// - We're changing the primary key and FK column types simultaneously
	// - Kysely's schema builder doesn't cleanly express this pattern
	// - Raw SQL is localized and clearly commented
	//
	// We use DROP COLUMN ... CASCADE rather than dropping FK/PK constraints by name.
	// The init migration creates FK constraints inline in CREATE TABLE, which may result
	// in auto-generated names that differ from what we'd expect. CASCADE automatically
	// drops all dependent objects (FK constraints, unique indexes, composite PKs, and
	// check constraints) regardless of their names.
	await sql`
    -- Add temp INTEGER columns before dropping the old TEXT ones
    ALTER TABLE "submission"
    ADD COLUMN "student_row_id" INTEGER;

    ALTER TABLE "student_to_team"
    ADD COLUMN "student_row_id" INTEGER;

    -- Populate new columns from the old text student_id
    UPDATE "submission"
    SET "student_row_id" = s."row_id"
    FROM "student" s
    WHERE s.id = "submission"."student_id";

    UPDATE "student_to_team"
    SET "student_row_id" = s."row_id"
    FROM "student" s
    WHERE s.id = "student_to_team"."student_id";

    -- Drop the old TEXT student_id columns with CASCADE.
    -- This automatically drops all dependent objects:
    --   submission: Submission_studentId_fkey (FK), Submission_studentId_key (unique index),
    --               Submission_type_participant_check (check constraint)
    --   student_to_team: StudentToTeam_studentId_fkey (FK), StudentToTeam_studentId_teamId_pkey (composite PK)
    ALTER TABLE "submission"
    DROP COLUMN "student_id" CASCADE;

    ALTER TABLE "student_to_team"
    DROP COLUMN "student_id" CASCADE;

    -- Rename temp columns to student_id
    ALTER TABLE "submission"
    RENAME COLUMN "student_row_id" TO "student_id";

    ALTER TABLE "student_to_team"
    RENAME COLUMN "student_row_id" TO "student_id";

    -- student_to_team.student_id must be NOT NULL (part of composite PK)
    ALTER TABLE "student_to_team"
    ALTER COLUMN "student_id" SET NOT NULL;

    -- Promote row_id to primary key on student
    ALTER TABLE "student"
    DROP CONSTRAINT "student_pkey";

    ALTER TABLE "student"
    ADD CONSTRAINT "student_pkey" PRIMARY KEY ("row_id");

    -- Recreate composite PK on student_to_team with the new INTEGER student_id
    ALTER TABLE "student_to_team"
    ADD CONSTRAINT "StudentToTeam_studentId_teamId_pkey"
    PRIMARY KEY ("student_id", "team_id");

    -- Recreate the unique index on submission.student_id
    CREATE UNIQUE INDEX "Submission_studentId_key"
    ON "submission" ("student_id");

    -- Recreate FK constraints pointing to student.row_id
    ALTER TABLE "submission"
    ADD CONSTRAINT "Submission_studentId_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student" ("row_id")
    ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "student_to_team"
    ADD CONSTRAINT "StudentToTeam_studentId_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student" ("row_id")
    ON DELETE CASCADE ON UPDATE CASCADE;

    -- Recreate the check constraint that was dropped by CASCADE above
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
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	// Reverse: restore TEXT student_id columns and revert to id as PK
	await sql`
    -- Add temp TEXT columns to restore old student_id values
    ALTER TABLE "submission"
    ADD COLUMN "student_id_text" TEXT;

    ALTER TABLE "student_to_team"
    ADD COLUMN "student_id_text" TEXT;

    -- Populate by joining INTEGER student_id back to student.id
    UPDATE "submission"
    SET "student_id_text" = s.id
    FROM "student" s
    WHERE s."row_id" = "submission"."student_id";

    UPDATE "student_to_team"
    SET "student_id_text" = s.id
    FROM "student" s
    WHERE s."row_id" = "student_to_team"."student_id";

    -- Drop INTEGER student_id columns with CASCADE.
    -- Automatically drops: Submission_studentId_fkey, Submission_studentId_key,
    -- Submission_type_participant_check, StudentToTeam_studentId_fkey,
    -- StudentToTeam_studentId_teamId_pkey.
    ALTER TABLE "submission"
    DROP COLUMN "student_id" CASCADE;

    ALTER TABLE "student_to_team"
    DROP COLUMN "student_id" CASCADE;

    -- Rename temp columns back to student_id
    ALTER TABLE "submission"
    RENAME COLUMN "student_id_text" TO "student_id";

    ALTER TABLE "student_to_team"
    RENAME COLUMN "student_id_text" TO "student_id";

    -- Set NOT NULL on student_to_team.student_id
    ALTER TABLE "student_to_team"
    ALTER COLUMN "student_id" SET NOT NULL;

    -- Drop new PK on student.row_id
    ALTER TABLE "student"
    DROP CONSTRAINT "student_pkey";

    -- Restore old PK on student.id
    ALTER TABLE "student"
    ADD CONSTRAINT "student_pkey" PRIMARY KEY (id);

    -- Recreate composite PK on student_to_team with TEXT student_id
    ALTER TABLE "student_to_team"
    ADD CONSTRAINT "StudentToTeam_studentId_teamId_pkey"
    PRIMARY KEY ("student_id", "team_id");

    -- Recreate unique index on submission.student_id (no WHERE clause, matching original init)
    CREATE UNIQUE INDEX "Submission_studentId_key" ON "submission" ("student_id");

    -- Recreate FK constraints pointing back to student.id
    ALTER TABLE "submission"
    ADD CONSTRAINT "Submission_studentId_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student" (id)
    ON DELETE SET NULL ON UPDATE CASCADE;

    ALTER TABLE "student_to_team"
    ADD CONSTRAINT "StudentToTeam_studentId_fkey"
    FOREIGN KEY ("student_id")
    REFERENCES "student" (id)
    ON DELETE CASCADE ON UPDATE CASCADE;

    -- Recreate the check constraint that was dropped by CASCADE above
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

    -- Drop student.row_id
    ALTER TABLE "student"
    DROP COLUMN "row_id";
  `.execute(db);
}
