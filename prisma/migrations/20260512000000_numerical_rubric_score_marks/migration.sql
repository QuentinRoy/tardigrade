-- Add new columns as nullable first so existing rows are not blocked
ALTER TABLE "NumericalRubric" ADD COLUMN "minScore" DECIMAL(10,2);
ALTER TABLE "NumericalRubric" ADD COLUMN "maxScore" DECIMAL(10,2);
ALTER TABLE "NumericalRubric" ADD COLUMN "minMarks" DECIMAL(10,2);
ALTER TABLE "NumericalRubric" ADD COLUMN "maxMarks" DECIMAL(10,2);

-- Copy old min/max values to all four new columns
UPDATE "NumericalRubric" SET
  "minScore" = "min",
  "maxScore" = "max",
  "minMarks" = "min",
  "maxMarks" = "max";

-- Now enforce NOT NULL
ALTER TABLE "NumericalRubric" ALTER COLUMN "minScore" SET NOT NULL;
ALTER TABLE "NumericalRubric" ALTER COLUMN "maxScore" SET NOT NULL;
ALTER TABLE "NumericalRubric" ALTER COLUMN "minMarks" SET NOT NULL;
ALTER TABLE "NumericalRubric" ALTER COLUMN "maxMarks" SET NOT NULL;

-- Drop old columns
ALTER TABLE "NumericalRubric" DROP COLUMN "min";
ALTER TABLE "NumericalRubric" DROP COLUMN "max";
