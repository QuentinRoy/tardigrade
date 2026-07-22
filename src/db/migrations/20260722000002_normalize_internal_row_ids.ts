import { type Kysely, sql } from "kysely";

// Finishes the row-ID naming convention for internal-only persistence tables
// (#322, #324): every generated surrogate is named `row_id` (or dropped where
// a table collapses onto a natural/composite key), and every FK column that
// holds a RowId is suffixed `_row_id`. These tables were collapsed onto
// natural or composite keys because their old `id` surrogates were unused
// Prisma-era artifacts: nothing addressed a `check_criterion`/`number_criterion`/
// `options_criterion` row except through its owning `criterion_id`, and
// nothing addressed a criterion-grade subtype row except through its owning
// `criterion_grade_id` — both 1:1/1:0..1 relationships, so the parent's own
// key already identified the row.
//
// Strict operation ordering (see docs/adr/0016-collapse-internal-surrogate-keys-onto-natural-keys.md):
//
// 1. Rename `_id` → `_row_id` on every internal FK column, including inside
//    `criterion`'s and `criterion_grade`'s existing composite FKs (ADR 0015)
//    — column renames propagate through composite constraint definitions.
// 2. Repoint the criterion-grade subtype tables (`check_criterion_grade`,
//    `number_criterion_grade`, `options_criterion_grade`) off their surrogate
//    `criterion_grade_id` FK onto `criterion_grade`'s natural composite key
//    directly, before `criterion_grade.id` is dropped.
// 3. Drop `criterion_grade.id`; promote its existing
//    `UNIQUE(grade_target_row_id, criterion_row_id)` to the primary key.
//    `grid_row_id` (the ADR 0015 consistency copy) and both composite FKs to
//    `criterion` and `grade_target` are untouched.
// 4. Give the criterion-grade subtype tables their final composite primary
//    key and FK onto `criterion_grade`'s new primary key.
// 5. Repoint `options_criterion_mark` off `options_criterion.id` onto
//    `options_criterion.criterion_row_id` directly, before
//    `options_criterion.id` is dropped.
// 6. Collapse the criterion subtype-config tables (`check_criterion`,
//    `number_criterion`, `options_criterion`): drop the surrogate `id`,
//    promote the already-unique `criterion_row_id` to the primary key.
//
// #144 / ADR 0015 invariants preserved throughout: no `grid_row_id` column is
// dropped, no composite FK is downgraded to single-column, and no
// `UNIQUE(row_id, grid_row_id)` on `rubric`/`criterion`/`grade_target` is
// touched — a cross-grid criterion/rubric or criterion/grade-target pairing
// stays structurally unrepresentable.
//
// Every renamed table here is keyed by a NOT NULL FK 1:1/1:0..1 with its
// parent, so every backfill below is a total, deterministic copy already
// guaranteed by an existing constraint — never a guess about ambiguous data.
//
// The `enforce_*_kind_match` trigger functions reference the renamed FK
// column by name in their body text and are recreated accordingly. Postgres
// tracks a trigger's `UPDATE OF column-list` by attribute number, not by
// name, so those triggers keep firing correctly through the rename without
// being recreated themselves — only their function bodies change. The
// `enforce_number_criterion_value_bounds` and `enforce_options_criterion_label_valid`
// triggers, by contrast, reference the dropped `criterion_grade_id` column
// directly in their `UPDATE OF` list, so both are recreated (function body
// and trigger definition) before that column is dropped.
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below is passed to Postgres verbatim and matches the live schema
// exactly (see docs/reference/database-migrations.md). DDL runs one statement
// at a time (concurrent ALTER only contends for locks).

type SubtypeGradeRow = {
	criterion_grade_id: number;
	grade_target_row_id: number | null;
	criterion_row_id: number | null;
};

type MigrationDB = {
	criterion_grade: {
		id: number;
		grade_target_row_id: number;
		criterion_row_id: number;
	};
	check_criterion_grade: SubtypeGradeRow;
	number_criterion_grade: SubtypeGradeRow;
	options_criterion_grade: SubtypeGradeRow;
	options_criterion: { id: number; criterion_row_id: number };
	options_criterion_mark: {
		options_criterion_id: number;
		criterion_row_id: number | null;
	};
};

const criterionGradeSubtypes = ["check", "number", "options"] as const;

export async function up(db: Kysely<MigrationDB>): Promise<void> {
	// --- Step 1: rename `_id` → `_row_id` on every internal FK column ---

	await db.schema
		.alterTable("criterion")
		.renameColumn("rubric_id", "rubric_row_id")
		.execute();
	await db.schema
		.alterTable("criterion")
		.renameConstraint(
			"criterion_rubric_id_grid_row_id_fkey",
			"criterion_rubric_row_id_grid_row_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion")
		.renameConstraint(
			"criterion_rubric_id_position_key",
			"criterion_rubric_row_id_position_key",
		)
		.execute();

	await db.schema
		.alterTable("criterion_grade")
		.renameColumn("criterion_id", "criterion_row_id")
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_grade_criterion_id_grid_row_id_fkey",
			"criterion_grade_criterion_row_id_grid_row_id_fkey",
		)
		.execute();

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion` as const;
		await db.schema
			.alterTable(table)
			.renameColumn("criterion_id", "criterion_row_id")
			.execute();
		await db.schema
			.alterTable(table)
			.renameConstraint(
				`${subtype}_criterion_criterion_id_fkey`,
				`${subtype}_criterion_criterion_row_id_fkey`,
			)
			.execute();
	}

	// The kind-match trigger definitions track their `UPDATE OF criterion_id`
	// column by attribute number and keep firing after the rename above; only
	// the function bodies' literal column references need updating.
	await sql`
    CREATE OR REPLACE FUNCTION enforce_check_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_row_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'CheckCriterion references unknown Criterion row id: %', NEW."criterion_row_id";
      END IF;

      IF criterion_kind <> 'check'::"criterion_kind" THEN
        RAISE EXCEPTION 'CheckCriterion with criterionRowId % requires Criterion.kind check, got %', NEW."criterion_row_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_options_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_row_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'OptionsCriterion references unknown Criterion row id: %', NEW."criterion_row_id";
      END IF;

      IF criterion_kind <> 'options'::"criterion_kind" THEN
        RAISE EXCEPTION 'OptionsCriterion with criterionRowId % requires Criterion.kind options, got %', NEW."criterion_row_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_number_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_row_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'NumberCriterion references unknown Criterion row id: %', NEW."criterion_row_id";
      END IF;

      IF criterion_kind <> 'number'::"criterion_kind" THEN
        RAISE EXCEPTION 'NumberCriterion with criterionRowId % requires Criterion.kind number, got %', NEW."criterion_row_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;
  `.execute(db);

	// --- Step 2: repoint the criterion-grade subtype tables off
	// `criterion_grade_id` onto `criterion_grade`'s natural composite key,
	// while `criterion_grade.id` still exists to backfill from. ---

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion_grade` as const;

		await db.schema
			.alterTable(table)
			.addColumn("grade_target_row_id", "integer")
			.execute();
		await db.schema
			.alterTable(table)
			.addColumn("criterion_row_id", "integer")
			.execute();

		await db
			.updateTable(table)
			.from("criterion_grade")
			.set((eb) => ({
				grade_target_row_id: eb.ref("criterion_grade.grade_target_row_id"),
				criterion_row_id: eb.ref("criterion_grade.criterion_row_id"),
			}))
			.whereRef(`${table}.criterion_grade_id`, "=", "criterion_grade.id")
			.execute();

		await db.schema
			.alterTable(table)
			.alterColumn("grade_target_row_id", (column) => column.setNotNull())
			.execute();
		await db.schema
			.alterTable(table)
			.alterColumn("criterion_row_id", (column) => column.setNotNull())
			.execute();
	}

	// Recreate the bounds/label-valid triggers against the new columns before
	// `criterion_grade_id` is dropped below (their old `UPDATE OF` list
	// depends on that column by attnum, unlike the kind-match triggers above,
	// so they must be recreated rather than left to track the rename).
	// Simplified along the way: both now look up their sibling subtype-config
	// row directly by `criterion_row_id` instead of hopping through
	// `criterion_grade`, since `criterion_row_id` already identifies it.
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
      WHERE nc.criterion_row_id = NEW.criterion_row_id;

      IF min_value IS NULL THEN
        RAISE EXCEPTION 'NumberCriterionGrade (grade_target_row_id=%, criterion_row_id=%) references no NumberCriterion', NEW.grade_target_row_id, NEW.criterion_row_id;
      END IF;

      IF NEW.value < min_value OR NEW.value > max_value THEN
        RAISE EXCEPTION 'NumberCriterionGrade value % is out of bounds [%, %]', NEW.value, min_value, max_value;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE TRIGGER trg_number_criterion_value_bounds
    BEFORE INSERT OR UPDATE OF value, criterion_row_id ON "number_criterion_grade"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_number_criterion_value_bounds();

    CREATE OR REPLACE FUNCTION enforce_options_criterion_label_valid()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      label_exists boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM "options_criterion_mark" ocm
        WHERE ocm.criterion_row_id = NEW.criterion_row_id
          AND ocm.label = NEW.selected_label
      ) INTO label_exists;

      IF NOT label_exists THEN
        RAISE EXCEPTION 'OptionsCriterionGrade selected_label "%" is not a valid label for criterion_row_id %', NEW.selected_label, NEW.criterion_row_id;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE TRIGGER trg_options_criterion_label_valid
    BEFORE INSERT OR UPDATE OF selected_label, criterion_row_id ON "options_criterion_grade"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_options_criterion_label_valid();
  `.execute(db);

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion_grade` as const;

		await db.schema
			.alterTable(table)
			.dropConstraint(`${table}_criterion_grade_id_fkey`)
			.execute();
		await db.schema
			.alterTable(table)
			.dropConstraint(`${table}_criterion_grade_id_key`)
			.execute();
		await db.schema.alterTable(table).dropConstraint(`${table}_pkey`).execute();
		await db.schema
			.alterTable(table)
			.dropColumn("criterion_grade_id")
			.execute();
		await db.schema.alterTable(table).dropColumn("id").execute();
	}

	// --- Step 3: drop `criterion_grade.id`; promote its existing
	// UNIQUE(grade_target_row_id, criterion_row_id) to the primary key. ---

	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_pkey")
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_grade_target_row_id_criterion_id_key")
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.addPrimaryKeyConstraint("criterion_grade_pkey", [
			"grade_target_row_id",
			"criterion_row_id",
		])
		.execute();
	await db.schema.alterTable("criterion_grade").dropColumn("id").execute();

	// --- Step 4: give the criterion-grade subtype tables their final
	// composite primary key and FK onto criterion_grade's new primary key. ---

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion_grade` as const;

		await db.schema
			.alterTable(table)
			.addPrimaryKeyConstraint(`${table}_pkey`, [
				"grade_target_row_id",
				"criterion_row_id",
			])
			.execute();
		await db.schema
			.alterTable(table)
			.addForeignKeyConstraint(
				`${table}_criterion_grade_fkey`,
				["grade_target_row_id", "criterion_row_id"],
				"criterion_grade",
				["grade_target_row_id", "criterion_row_id"],
				(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
			)
			.execute();
	}

	// --- Step 5: repoint options_criterion_mark off options_criterion.id
	// onto options_criterion.criterion_row_id, before options_criterion.id is
	// dropped in step 6. ---

	await db.schema
		.alterTable("options_criterion_mark")
		.addColumn("criterion_row_id", "integer")
		.execute();
	await db
		.updateTable("options_criterion_mark")
		.from("options_criterion")
		.set((eb) => ({
			criterion_row_id: eb.ref("options_criterion.criterion_row_id"),
		}))
		.whereRef(
			"options_criterion.id",
			"=",
			"options_criterion_mark.options_criterion_id",
		)
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.alterColumn("criterion_row_id", (column) => column.setNotNull())
		.execute();

	await db.schema
		.dropIndex("options_criterion_mark_options_criterion_id_label_idx")
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.dropConstraint("options_criterion_mark_options_criterion_id_label_key")
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.dropConstraint("options_criterion_mark_options_criterion_id_fkey")
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.dropColumn("options_criterion_id")
		.execute();

	// --- Step 6: collapse the criterion subtype-config tables onto their
	// already-unique criterion_row_id. options_criterion_mark deferred its new
	// FK (below) until after this step, since it must target
	// options_criterion's post-collapse primary key: adding it earlier would
	// pin the pre-collapse unique constraint in place and block the drop.

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion` as const;

		await db.schema.alterTable(table).dropConstraint(`${table}_pkey`).execute();
		await db.schema
			.alterTable(table)
			.dropConstraint(`${table}_criterion_id_key`)
			.execute();
		await db.schema
			.alterTable(table)
			.addPrimaryKeyConstraint(`${table}_pkey`, ["criterion_row_id"])
			.execute();
		await db.schema.alterTable(table).dropColumn("id").execute();
	}

	await db.schema
		.alterTable("options_criterion_mark")
		.addUniqueConstraint("options_criterion_mark_criterion_row_id_label_key", [
			"criterion_row_id",
			"label",
		])
		.execute();
	await db.schema
		.createIndex("options_criterion_mark_criterion_row_id_label_idx")
		.on("options_criterion_mark")
		.columns(["criterion_row_id", "label"])
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.addForeignKeyConstraint(
			"options_criterion_mark_criterion_row_id_fkey",
			["criterion_row_id"],
			"options_criterion",
			["criterion_row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.alterTable("options_criterion_mark")
		.renameColumn("id", "row_id")
		.execute();
}

export async function down(db: Kysely<MigrationDB>): Promise<void> {
	// --- Reverse the options_criterion_mark FK added after step 6, before
	// step 6 itself is reversed: it targets options_criterion's post-collapse
	// primary key, so it must go first or the pre-collapse pkey restored below
	// can't be dropped out from under it. ---

	await db.schema
		.alterTable("options_criterion_mark")
		.renameColumn("row_id", "id")
		.execute();

	await db.schema
		.alterTable("options_criterion_mark")
		.dropConstraint("options_criterion_mark_criterion_row_id_fkey")
		.execute();
	await db.schema
		.dropIndex("options_criterion_mark_criterion_row_id_label_idx")
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.dropConstraint("options_criterion_mark_criterion_row_id_label_key")
		.execute();

	// --- Reverse step 6: give the criterion subtype-config tables back a
	// surrogate id, before options_criterion_mark needs options_criterion.id
	// again below. ---

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion` as const;

		await db.schema
			.alterTable(table)
			.addColumn("id", "integer", (column) =>
				column.generatedAlwaysAsIdentity(),
			)
			.execute();
		await db.schema.alterTable(table).dropConstraint(`${table}_pkey`).execute();
		await db.schema
			.alterTable(table)
			.addUniqueConstraint(`${table}_criterion_id_key`, ["criterion_row_id"])
			.execute();
		await db.schema
			.alterTable(table)
			.addPrimaryKeyConstraint(`${table}_pkey`, ["id"])
			.execute();
	}

	// --- Reverse step 5 ---

	await db.schema
		.alterTable("options_criterion_mark")
		.addColumn("options_criterion_id", "integer")
		.execute();
	await db
		.updateTable("options_criterion_mark")
		.from("options_criterion")
		.set((eb) => ({ options_criterion_id: eb.ref("options_criterion.id") }))
		.whereRef(
			"options_criterion.criterion_row_id",
			"=",
			"options_criterion_mark.criterion_row_id",
		)
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.alterColumn("options_criterion_id", (column) => column.setNotNull())
		.execute();

	await db.schema
		.alterTable("options_criterion_mark")
		.addForeignKeyConstraint(
			"options_criterion_mark_options_criterion_id_fkey",
			["options_criterion_id"],
			"options_criterion",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();
	await db.schema
		.alterTable("options_criterion_mark")
		.addUniqueConstraint(
			"options_criterion_mark_options_criterion_id_label_key",
			["options_criterion_id", "label"],
		)
		.execute();
	await db.schema
		.createIndex("options_criterion_mark_options_criterion_id_label_idx")
		.on("options_criterion_mark")
		.columns(["options_criterion_id", "label"])
		.execute();

	await db.schema
		.alterTable("options_criterion_mark")
		.dropColumn("criterion_row_id")
		.execute();

	// --- Reverse step 4 ---

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion_grade` as const;

		await db.schema
			.alterTable(table)
			.dropConstraint(`${table}_criterion_grade_fkey`)
			.execute();
		await db.schema.alterTable(table).dropConstraint(`${table}_pkey`).execute();
	}

	// --- Reverse step 3 ---

	await db.schema
		.alterTable("criterion_grade")
		.addColumn("id", "integer", (column) => column.generatedAlwaysAsIdentity())
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.dropConstraint("criterion_grade_pkey")
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.addUniqueConstraint(
			"criterion_grade_grade_target_row_id_criterion_id_key",
			["grade_target_row_id", "criterion_row_id"],
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.addPrimaryKeyConstraint("criterion_grade_pkey", ["id"])
		.execute();

	// --- Reverse step 2 ---

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion_grade` as const;

		await db.schema
			.alterTable(table)
			.addColumn("id", "integer", (column) =>
				column.generatedAlwaysAsIdentity(),
			)
			.execute();
		await db.schema
			.alterTable(table)
			.addColumn("criterion_grade_id", "integer")
			.execute();
		await db
			.updateTable(table)
			.from("criterion_grade")
			.set((eb) => ({ criterion_grade_id: eb.ref("criterion_grade.id") }))
			.whereRef(
				`${table}.grade_target_row_id`,
				"=",
				"criterion_grade.grade_target_row_id",
			)
			.whereRef(
				`${table}.criterion_row_id`,
				"=",
				"criterion_grade.criterion_row_id",
			)
			.execute();
		await db.schema
			.alterTable(table)
			.alterColumn("criterion_grade_id", (column) => column.setNotNull())
			.execute();

		await db.schema
			.alterTable(table)
			.addPrimaryKeyConstraint(`${table}_pkey`, ["id"])
			.execute();
		await db.schema
			.alterTable(table)
			.addUniqueConstraint(`${table}_criterion_grade_id_key`, [
				"criterion_grade_id",
			])
			.execute();
		await db.schema
			.alterTable(table)
			.addForeignKeyConstraint(
				`${table}_criterion_grade_id_fkey`,
				["criterion_grade_id"],
				"criterion_grade",
				["id"],
				(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
			)
			.execute();

		await db.schema
			.alterTable(table)
			.dropColumn("grade_target_row_id")
			.execute();
	}

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
      INNER JOIN "criterion_grade" cg ON cg.criterion_row_id = nc.criterion_row_id
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

    CREATE OR REPLACE TRIGGER trg_number_criterion_value_bounds
    BEFORE INSERT OR UPDATE OF value, criterion_grade_id ON "number_criterion_grade"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_number_criterion_value_bounds();

    CREATE OR REPLACE FUNCTION enforce_options_criterion_label_valid()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      label_exists boolean;
    BEGIN
      SELECT EXISTS (
        SELECT 1
        FROM "criterion_grade" cg
        INNER JOIN "options_criterion" oc ON oc.criterion_row_id = cg.criterion_row_id
        INNER JOIN "options_criterion_mark" ocm ON ocm.criterion_row_id = oc.criterion_row_id
        WHERE cg.id = NEW.criterion_grade_id
          AND ocm.label = NEW.selected_label
      ) INTO label_exists;

      IF NOT label_exists THEN
        RAISE EXCEPTION 'OptionsCriterionGrade selected_label "%" is not a valid label for criterion_grade %', NEW.selected_label, NEW.criterion_grade_id;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE TRIGGER trg_options_criterion_label_valid
    BEFORE INSERT OR UPDATE OF selected_label, criterion_grade_id ON "options_criterion_grade"
    FOR EACH ROW
    EXECUTE FUNCTION enforce_options_criterion_label_valid();
  `.execute(db);

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion_grade` as const;
		await db.schema.alterTable(table).dropColumn("criterion_row_id").execute();
	}

	// --- Reverse step 1 ---

	await sql`
    CREATE OR REPLACE FUNCTION enforce_check_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'CheckCriterion references unknown Criterion row id: %', NEW."criterion_id";
      END IF;

      IF criterion_kind <> 'check'::"criterion_kind" THEN
        RAISE EXCEPTION 'CheckCriterion with criterionId % requires Criterion.kind check, got %', NEW."criterion_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_options_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'OptionsCriterion references unknown Criterion row id: %', NEW."criterion_id";
      END IF;

      IF criterion_kind <> 'options'::"criterion_kind" THEN
        RAISE EXCEPTION 'OptionsCriterion with criterionId % requires Criterion.kind options, got %', NEW."criterion_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;

    CREATE OR REPLACE FUNCTION enforce_number_criterion_kind_match()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $$
    DECLARE
      criterion_kind "criterion_kind";
    BEGIN
      SELECT c.kind INTO criterion_kind
      FROM "criterion" c
      WHERE c.row_id = NEW."criterion_id";

      IF criterion_kind IS NULL THEN
        RAISE EXCEPTION 'NumberCriterion references unknown Criterion row id: %', NEW."criterion_id";
      END IF;

      IF criterion_kind <> 'number'::"criterion_kind" THEN
        RAISE EXCEPTION 'NumberCriterion with criterionId % requires Criterion.kind number, got %', NEW."criterion_id", criterion_kind;
      END IF;

      RETURN NEW;
    END;
    $$;
  `.execute(db);

	for (const subtype of criterionGradeSubtypes) {
		const table = `${subtype}_criterion` as const;
		await db.schema
			.alterTable(table)
			.renameConstraint(
				`${subtype}_criterion_criterion_row_id_fkey`,
				`${subtype}_criterion_criterion_id_fkey`,
			)
			.execute();
		await db.schema
			.alterTable(table)
			.renameColumn("criterion_row_id", "criterion_id")
			.execute();
	}

	await db.schema
		.alterTable("criterion_grade")
		.renameConstraint(
			"criterion_grade_criterion_row_id_grid_row_id_fkey",
			"criterion_grade_criterion_id_grid_row_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion_grade")
		.renameColumn("criterion_row_id", "criterion_id")
		.execute();

	await db.schema
		.alterTable("criterion")
		.renameConstraint(
			"criterion_rubric_row_id_position_key",
			"criterion_rubric_id_position_key",
		)
		.execute();
	await db.schema
		.alterTable("criterion")
		.renameConstraint(
			"criterion_rubric_row_id_grid_row_id_fkey",
			"criterion_rubric_id_grid_row_id_fkey",
		)
		.execute();
	await db.schema
		.alterTable("criterion")
		.renameColumn("rubric_row_id", "rubric_id")
		.execute();
}
