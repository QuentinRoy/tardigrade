DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "BooleanRubric" br
    JOIN "Rubric" r ON r.id = br."rubricId"
    WHERE r.type <> 'BOOLEAN'::"RubricType"
  ) THEN
    RAISE EXCEPTION 'Cannot apply migration: found BooleanRubric rows linked to non-BOOLEAN Rubric rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "OrdinalRubric" oru
    JOIN "Rubric" r ON r.id = oru."rubricId"
    WHERE r.type <> 'ORDINAL'::"RubricType"
  ) THEN
    RAISE EXCEPTION 'Cannot apply migration: found OrdinalRubric rows linked to non-ORDINAL Rubric rows';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "NumericalRubric" nr
    JOIN "Rubric" r ON r.id = nr."rubricId"
    WHERE r.type <> 'NUMERICAL'::"RubricType"
  ) THEN
    RAISE EXCEPTION 'Cannot apply migration: found NumericalRubric rows linked to non-NUMERICAL Rubric rows';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_boolean_rubric_type_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rubric_type "RubricType";
BEGIN
  SELECT r.type INTO rubric_type
  FROM "Rubric" r
  WHERE r.id = NEW."rubricId";

  IF rubric_type IS NULL THEN
    RAISE EXCEPTION 'BooleanRubric references unknown Rubric id: %', NEW."rubricId";
  END IF;

  IF rubric_type <> 'BOOLEAN'::"RubricType" THEN
    RAISE EXCEPTION 'BooleanRubric with rubricId % requires Rubric.type BOOLEAN, got %', NEW."rubricId", rubric_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_ordinal_rubric_type_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rubric_type "RubricType";
BEGIN
  SELECT r.type INTO rubric_type
  FROM "Rubric" r
  WHERE r.id = NEW."rubricId";

  IF rubric_type IS NULL THEN
    RAISE EXCEPTION 'OrdinalRubric references unknown Rubric id: %', NEW."rubricId";
  END IF;

  IF rubric_type <> 'ORDINAL'::"RubricType" THEN
    RAISE EXCEPTION 'OrdinalRubric with rubricId % requires Rubric.type ORDINAL, got %', NEW."rubricId", rubric_type;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION enforce_numerical_rubric_type_match()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  rubric_type "RubricType";
BEGIN
  SELECT r.type INTO rubric_type
  FROM "Rubric" r
  WHERE r.id = NEW."rubricId";

  IF rubric_type IS NULL THEN
    RAISE EXCEPTION 'NumericalRubric references unknown Rubric id: %', NEW."rubricId";
  END IF;

  IF rubric_type <> 'NUMERICAL'::"RubricType" THEN
    RAISE EXCEPTION 'NumericalRubric with rubricId % requires Rubric.type NUMERICAL, got %', NEW."rubricId", rubric_type;
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

DROP TRIGGER IF EXISTS trg_boolean_rubric_type_match ON "BooleanRubric";
CREATE TRIGGER trg_boolean_rubric_type_match
BEFORE INSERT OR UPDATE OF "rubricId" ON "BooleanRubric"
FOR EACH ROW
EXECUTE FUNCTION enforce_boolean_rubric_type_match();

DROP TRIGGER IF EXISTS trg_ordinal_rubric_type_match ON "OrdinalRubric";
CREATE TRIGGER trg_ordinal_rubric_type_match
BEFORE INSERT OR UPDATE OF "rubricId" ON "OrdinalRubric"
FOR EACH ROW
EXECUTE FUNCTION enforce_ordinal_rubric_type_match();

DROP TRIGGER IF EXISTS trg_numerical_rubric_type_match ON "NumericalRubric";
CREATE TRIGGER trg_numerical_rubric_type_match
BEFORE INSERT OR UPDATE OF "rubricId" ON "NumericalRubric"
FOR EACH ROW
EXECUTE FUNCTION enforce_numerical_rubric_type_match();

DROP TRIGGER IF EXISTS trg_rubric_type_change_compatibility ON "Rubric";
DROP TRIGGER IF EXISTS trg_rubric_type_immutable ON "Rubric";
CREATE TRIGGER trg_rubric_type_immutable
BEFORE UPDATE OF type ON "Rubric"
FOR EACH ROW
EXECUTE FUNCTION enforce_rubric_type_immutable();

DROP FUNCTION IF EXISTS enforce_rubric_type_change_compatibility();
