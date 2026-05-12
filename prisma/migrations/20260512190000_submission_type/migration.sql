-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('INDIVIDUAL', 'TEAM');

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_StudentToTeam" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_StudentToTeam_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "Team_name_key" ON "Team"("name");

-- CreateIndex
CREATE INDEX "_StudentToTeam_B_index" ON "_StudentToTeam"("B");

-- Migrate data: Create teams from unique submission team names
INSERT INTO "Team" (id, name, "createdAt", "updatedAt")
SELECT 
  CONCAT('team-', REPLACE(LOWER("team"), ' ', '-')),
  "team",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Submission"
WHERE "team" IS NOT NULL
GROUP BY "team"
ON CONFLICT DO NOTHING;

-- AlterTable: Add new columns before dropping old ones
ALTER TABLE "Submission" 
ADD COLUMN "studentId" TEXT,
ADD COLUMN "teamId" TEXT,
ADD COLUMN "type" "SubmissionType" NOT NULL DEFAULT 'INDIVIDUAL';

-- Migrate submission data: Match students to their submissions and set type
UPDATE "Submission" s
SET 
  "studentId" = CASE
    WHEN s."team" IS NULL THEN (
      SELECT id FROM "Student"
      WHERE "submissionId" = s.id
      LIMIT 1
    )
    ELSE NULL
  END,
  "teamId" = CASE
    WHEN s."team" IS NOT NULL THEN (
      SELECT t.id FROM "Team" t
      WHERE t.name = s."team"
    )
    ELSE NULL
  END,
  "type" = CASE 
    WHEN s."team" IS NOT NULL THEN 'TEAM'::"SubmissionType"
    ELSE 'INDIVIDUAL'::"SubmissionType"
  END;

-- Enforce participant consistency by submission type
ALTER TABLE "Submission"
ADD CONSTRAINT "Submission_type_participant_check"
CHECK (
  (
    "type" = 'INDIVIDUAL'::"SubmissionType"
    AND "studentId" IS NOT NULL
    AND "teamId" IS NULL
  )
  OR
  (
    "type" = 'TEAM'::"SubmissionType"
    AND "teamId" IS NOT NULL
    AND "studentId" IS NULL
  )
);

-- Populate _StudentToTeam junction table
INSERT INTO "_StudentToTeam" ("A", "B")
SELECT DISTINCT s.id, t.id
FROM "Student" s
JOIN "Submission" sub ON s."submissionId" = sub.id
JOIN "Team" t ON sub."team" = t.name
WHERE s."submissionId" IS NOT NULL
AND sub."team" IS NOT NULL
ON CONFLICT DO NOTHING;

-- DropForeignKey
ALTER TABLE "Student" DROP CONSTRAINT "Student_submissionId_fkey";

-- AlterTable: Drop old columns
ALTER TABLE "Student" DROP COLUMN "submissionId";
ALTER TABLE "Submission" DROP COLUMN "team";

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentToTeam" ADD CONSTRAINT "_StudentToTeam_A_fkey" FOREIGN KEY ("A") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_StudentToTeam" ADD CONSTRAINT "_StudentToTeam_B_fkey" FOREIGN KEY ("B") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
