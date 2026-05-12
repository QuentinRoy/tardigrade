-- Rename Paper table to Submission
ALTER TABLE "Paper" RENAME TO "Submission";

-- Rename primary key constraint
ALTER TABLE "Submission" RENAME CONSTRAINT "Paper_pkey" TO "Submission_pkey";

-- Drop stored label (now derived from students at the app layer)
ALTER TABLE "Submission" DROP COLUMN "label";

-- Drop redundant team column from Student (always equals submission.team)
ALTER TABLE "Student" DROP COLUMN "team";

-- Rename paperId → submissionId in Student
ALTER TABLE "Student" RENAME COLUMN "paperId" TO "submissionId";
ALTER TABLE "Student" RENAME CONSTRAINT "Student_paperId_fkey" TO "Student_submissionId_fkey";

-- Rename paperId → submissionId in Assessment
ALTER TABLE "Assessment" RENAME COLUMN "paperId" TO "submissionId";
ALTER TABLE "Assessment" RENAME CONSTRAINT "Assessment_paperId_fkey" TO "Assessment_submissionId_fkey";
ALTER INDEX "Assessment_paperId_questionId_key" RENAME TO "Assessment_submissionId_questionId_key";
