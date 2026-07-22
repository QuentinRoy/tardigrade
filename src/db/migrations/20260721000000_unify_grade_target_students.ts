import { type Generated, type Kysely, sql } from "kysely";

// Unifies the Grade Target persistence model per ADR 0014 (#292): a Grade
// Target is a set of one or more Students, with no separate persisted
// individual/group discriminator. Membership moves to a new
// `grade_target_student` join table; the group's `name` moves directly onto
// `grade_target`; the `kind` enum column, its XOR CHECK, the `group` table,
// and the `student_to_group` join table are removed. Individual vs. group is
// derived at read time (name-OR-multimember rule), never stored.
//
// The Partition Rule (a Student belongs to at most one Grade Target) is
// enforced by making `grade_target_student.student_row_id` the table's
// primary key — a Student only ever belongs to one Grid, so this is
// inherently per-Grid. The at-least-one-member invariant is not expressible
// as a column CHECK once membership is a join table (see ADR 0014's
// Alternatives); it is a write-boundary guarantee in the app, not enforced
// here.
//
// Both pre-flight assertions below are expected to find zero rows in every
// real environment (see the issue's "Further Notes"): import always assigns
// exactly one target per Student and always populates members, and
// `group.name` is currently NOT NULL so every existing group is already
// named. The checks are a safety net, not an expected path — if either
// fires, the migration aborts rather than silently discarding the grades
// attached to the affected targets, and the affected rows need manual
// reconciliation before retrying.
//
// Data changes go through the Kysely query builder (typed against the local
// `MigrationDB` below, per docs/reference/database-migrations.md). Standalone
// raw `sql` — a whole statement or predicate the builder can't express — is
// confined to two spots, each commented at its call site: the `'group-' || id`
// string concatenation in the `down` name synthesis (Kysely has no `||`
// operator builder) and the re-added CHECK constraint body. The small `sql`
// fragments for a column's enum type (`sql\`"grade_target_kind"\``) and a
// `CURRENT_TIMESTAMP` default are the repo's usual builder idioms, not raw
// statements.
//
// The migration runners build Kysely without CamelCasePlugin, so every
// identifier below is passed to Postgres verbatim and matches the live
// schema exactly (see docs/reference/database-migrations.md).

type MigrationDB = {
	grade_target: {
		row_id: Generated<number>;
		id: string;
		grid_row_id: number;
		// Nullable across the whole file: the column does not exist until `up`
		// adds it and is dropped again by `down`. Typing it nullable also lets
		// `down` compare `kind is null` on freshly-added rows.
		kind: "individual" | "group" | null;
		group_row_id: number | null;
		student_row_id: number | null;
		name: string | null;
	};
	grade_target_student: { grade_target_row_id: number; student_row_id: number };
	group: { id: Generated<number>; name: string; grid_row_id: number };
	student_to_group: { student_id: number; group_id: number };
};

async function assertNoPartitionViolations(
	db: Kysely<MigrationDB>,
): Promise<void> {
	// A partition violation is a Student attached to more than one Grade
	// Target once individual `student_row_id` ownership and `student_to_group`
	// membership are merged into a single relation — either a Student who is
	// both an individual target's owner and a group member, or a Student
	// listed in more than one group. Collect every (student → target)
	// membership and look for a repeated student.
	const individualMembers = db
		.selectFrom("grade_target")
		.where("kind", "=", "individual")
		.where("student_row_id", "is not", null)
		.select("student_row_id");
	const groupMembers = db
		.selectFrom("grade_target as gt")
		.innerJoin("student_to_group as stg", "stg.group_id", "gt.group_row_id")
		.where("gt.kind", "=", "group")
		.select("stg.student_id as student_row_id");

	const memberships = await db
		.selectFrom(individualMembers.unionAll(groupMembers).as("memberships"))
		.select("student_row_id")
		.execute();

	const seen = new Set<number>();
	const duplicated = new Set<number>();
	for (const { student_row_id } of memberships) {
		if (student_row_id == null) {
			continue;
		}
		if (seen.has(student_row_id)) {
			duplicated.add(student_row_id);
		} else {
			seen.add(student_row_id);
		}
	}

	if (duplicated.size > 0) {
		throw new Error(
			`Cannot migrate grade targets to the unified membership model: ${duplicated.size} ` +
				"student(s) are attached to more than one grade target (both an " +
				"individual target and a group, or more than one group). The new " +
				"model requires each student to belong to at most one grade target " +
				"per grid (the Partition Rule), and automatically picking one " +
				"target to keep would silently discard the other's grades. " +
				"Reconcile these students' grade targets by hand before retrying " +
				"this migration.",
		);
	}
}

async function assertNoEmptyGroups(db: Kysely<MigrationDB>): Promise<void> {
	// A group grade target with no members cannot be represented once
	// membership is a join table with an implicit at-least-one-member
	// invariant: it would either need a synthesized member (fabricating data)
	// or be silently dropped (losing whatever grades are attached to it).
	const emptyGroups = await db
		.selectFrom("grade_target as gt")
		.where("gt.kind", "=", "group")
		.where((eb) =>
			eb.not(
				eb.exists(
					eb
						.selectFrom("student_to_group as stg")
						.whereRef("stg.group_id", "=", "gt.group_row_id")
						.select("stg.student_id"),
				),
			),
		)
		.select("gt.id")
		.execute();

	if (emptyGroups.length > 0) {
		throw new Error(
			`Cannot migrate grade targets to the unified membership model: ${emptyGroups.length} ` +
				"group grade target(s) have no members. The new model requires " +
				"every grade target to have at least one member, and dropping " +
				"these targets would silently discard whatever grades are attached " +
				"to them. Reconcile these empty groups by hand (add a member or " +
				"remove the target and its grades deliberately) before retrying " +
				"this migration.",
		);
	}
}

export async function up(db: Kysely<MigrationDB>): Promise<void> {
	await assertNoPartitionViolations(db);
	await assertNoEmptyGroups(db);

	// The Group Name moves directly onto `grade_target`. Nullable: an
	// Individual never carries a name.
	await db.schema
		.alterTable("grade_target")
		.addColumn("name", "text")
		.execute();

	await db
		.updateTable("grade_target")
		.from("group")
		.set((eb) => ({ name: eb.ref("group.name") }))
		.whereRef("group.id", "=", "grade_target.group_row_id")
		.execute();

	// `student_row_id` is the primary key, not `grade_target_row_id` +
	// `student_row_id`: making it the sole key is what enforces the Partition
	// Rule (a student belongs to at most one grade target) directly, rather
	// than as a separate constraint alongside a composite key that would
	// otherwise allow the same student attached to a target more than once.
	await db.schema
		.createTable("grade_target_student")
		.addColumn("grade_target_row_id", "integer", (column) => column.notNull())
		.addColumn("student_row_id", "integer", (column) =>
			column.notNull().primaryKey(),
		)
		.addForeignKeyConstraint(
			"grade_target_student_grade_target_row_id_fkey",
			["grade_target_row_id"],
			"grade_target",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"grade_target_student_student_row_id_fkey",
			["student_row_id"],
			"student",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	// Non-unique: several students share a grade_target_row_id (group
	// members), so this is a plain lookup index, not a constraint.
	await db.schema
		.createIndex("grade_target_student_grade_target_row_id_idx")
		.on("grade_target_student")
		.column("grade_target_row_id")
		.execute();

	// One membership row per individual target's sole student. The XOR CHECK
	// guarantees `student_row_id` is non-null for individual rows; narrow the
	// type accordingly for the non-null join-table column.
	await db
		.insertInto("grade_target_student")
		.columns(["grade_target_row_id", "student_row_id"])
		.expression(
			db
				.selectFrom("grade_target")
				.where("kind", "=", "individual")
				.where("student_row_id", "is not", null)
				.select(["row_id", "student_row_id"])
				.$narrowType<{ student_row_id: number }>(),
		)
		.execute();

	// One membership row per group member.
	await db
		.insertInto("grade_target_student")
		.columns(["grade_target_row_id", "student_row_id"])
		.expression(
			db
				.selectFrom("grade_target as gt")
				.innerJoin("student_to_group as stg", "stg.group_id", "gt.group_row_id")
				.where("gt.kind", "=", "group")
				.select(["gt.row_id", "stg.student_id"]),
		)
		.execute();

	// Group Name uniqueness within a grid. Postgres treats NULLs as distinct
	// in a UNIQUE constraint, so unnamed individuals are unconstrained.
	await db.schema
		.alterTable("grade_target")
		.addUniqueConstraint("grade_target_name_grid_row_id_key", [
			"name",
			"grid_row_id",
		])
		.execute();

	await db.schema
		.alterTable("grade_target")
		.dropConstraint("grade_target_kind_participant_check")
		.execute();
	await db.schema.alterTable("grade_target").dropColumn("kind").execute();
	await db.schema
		.alterTable("grade_target")
		.dropColumn("group_row_id")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.dropColumn("student_row_id")
		.execute();

	await db.schema.dropTable("student_to_group").execute();
	await db.schema.dropTable("group").execute();
	await db.schema.dropType("grade_target_kind").execute();
}

export async function down(db: Kysely<MigrationDB>): Promise<void> {
	// A memberless target can't be attributed a kind (no name, no member to
	// fall back on) — this only fires if the app violated the at-least-one-
	// member write-boundary guarantee after this migration ran.
	const emptyTargets = await db
		.selectFrom("grade_target as gt")
		.where((eb) =>
			eb.not(
				eb.exists(
					eb
						.selectFrom("grade_target_student as gts")
						.whereRef("gts.grade_target_row_id", "=", "gt.row_id")
						.select("gts.student_row_id"),
				),
			),
		)
		.select("gt.id")
		.execute();
	if (emptyTargets.length > 0) {
		throw new Error(
			`Cannot reverse the grade target membership migration: ${emptyTargets.length} ` +
				"grade target(s) have no members. The pre-#292 model requires every " +
				"target to resolve to exactly one owning student or group, and a " +
				"memberless target cannot be assigned either. Add a member or " +
				"remove the target before retrying this down migration.",
		);
	}

	await db.schema
		.createType("grade_target_kind")
		.asEnum(["individual", "group"])
		.execute();

	await db.schema
		.createTable("group")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("name", "text", (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("grid_row_id", "integer", (column) => column.notNull())
		.addUniqueConstraint("group_name_grid_row_id_key", ["name", "grid_row_id"])
		.addForeignKeyConstraint(
			"group_grid_row_id_fkey",
			["grid_row_id"],
			"grid",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("group_grid_row_id_idx")
		.on("group")
		.column("grid_row_id")
		.execute();

	await db.schema
		.createTable("student_to_group")
		.addColumn("student_id", "integer", (column) => column.notNull())
		.addColumn("group_id", "integer", (column) => column.notNull())
		.addPrimaryKeyConstraint("student_to_group_student_id_group_id_pkey", [
			"student_id",
			"group_id",
		])
		.addForeignKeyConstraint(
			"student_to_group_student_id_fkey",
			["student_id"],
			"student",
			["row_id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.addForeignKeyConstraint(
			"student_to_group_group_id_fkey",
			["group_id"],
			"group",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex("student_to_group_group_id_index")
		.on("student_to_group")
		.column("group_id")
		.execute();

	await db.schema
		.alterTable("grade_target")
		.addColumn("kind", sql`"grade_target_kind"`)
		.execute();
	await db.schema
		.alterTable("grade_target")
		.addColumn("group_row_id", "integer")
		.execute();
	await db.schema
		.alterTable("grade_target")
		.addColumn("student_row_id", "integer")
		.execute();

	// Reconstruct the group entity for every group-shaped target, mirroring
	// the read-time name-OR-multimember rule (ADR 0014): a target with a name
	// or more than one member is a group. Up-migrated rows round-trip exactly
	// (every existing group was named); only a later app-created unnamed
	// multi-member target needs a synthesized `group-<public id>` name — a
	// bounded, accepted irreversibility (see ADR 0014's Decision).
	//
	// The synthesized name uses a raw `sql` fragment for the `||` string
	// concatenation, which Kysely's expression builder has no operator for;
	// the surrounding COALESCE, member-count check, and all other clauses use
	// the builder. `member_count` is `$castTo<number>()`'d only to reconcile
	// COUNT's bigint result type with the numeric comparison — no SQL cast is
	// emitted.
	await db
		.insertInto("group")
		.columns(["name", "grid_row_id"])
		.expression(
			db
				.selectFrom("grade_target")
				.where((eb) =>
					eb.or([
						eb("grade_target.name", "is not", null),
						eb(
							eb
								.selectFrom("grade_target_student as member")
								.whereRef(
									"member.grade_target_row_id",
									"=",
									"grade_target.row_id",
								)
								.select((e) =>
									e.fn.countAll().$castTo<number>().as("member_count"),
								),
							">",
							1,
						),
					]),
				)
				.select((eb) => [
					eb.fn
						.coalesce(
							"grade_target.name",
							sql<string>`'group-' || ${eb.ref("grade_target.id")}`,
						)
						.as("name"),
					"grade_target.grid_row_id",
				]),
		)
		.execute();

	// Link each group-shaped target back to the group row just inserted for
	// it, matched by (grid, name) — group names are unique per grid, so the
	// synthesized name reproduces the same match key used above.
	await db
		.updateTable("grade_target")
		.from("group")
		.set((eb) => ({
			kind: "group" as const,
			group_row_id: eb.ref("group.id"),
			student_row_id: null,
		}))
		.whereRef("group.grid_row_id", "=", "grade_target.grid_row_id")
		.where((eb) =>
			eb(
				"group.name",
				"=",
				eb.fn.coalesce(
					"grade_target.name",
					sql<string>`'group-' || ${eb.ref("grade_target.id")}`,
				),
			),
		)
		.where((eb) =>
			eb.or([
				eb("grade_target.name", "is not", null),
				eb(
					eb
						.selectFrom("grade_target_student as member")
						.whereRef("member.grade_target_row_id", "=", "grade_target.row_id")
						.select((e) =>
							e.fn.countAll().$castTo<number>().as("member_count"),
						),
					">",
					1,
				),
			]),
		)
		.execute();

	// Rebuild the group membership join from the surviving grade_target_student
	// rows of the now-linked group targets.
	await db
		.insertInto("student_to_group")
		.columns(["student_id", "group_id"])
		.expression(
			db
				.selectFrom("grade_target as gt")
				.innerJoin(
					"grade_target_student as gts",
					"gts.grade_target_row_id",
					"gt.row_id",
				)
				.where("gt.kind", "=", "group")
				.select(["gts.student_row_id", "gt.group_row_id"])
				.$narrowType<{ group_row_id: number }>(),
		)
		.execute();

	// Everything not turned into a group is an unnamed single-member target:
	// reconstruct it as an individual pointing at its one member.
	await db
		.updateTable("grade_target")
		.from("grade_target_student as gts")
		.set((eb) => ({
			kind: "individual" as const,
			student_row_id: eb.ref("gts.student_row_id"),
			group_row_id: null,
		}))
		.whereRef("gts.grade_target_row_id", "=", "grade_target.row_id")
		.where("grade_target.kind", "is", null)
		.execute();

	await db.schema
		.alterTable("grade_target")
		.alterColumn("kind", (column) => column.setNotNull())
		.execute();
	await db.schema
		.alterTable("grade_target")
		.alterColumn("kind", (column) => column.setDefault("individual"))
		.execute();

	// Raw `sql` for the CHECK body: `addCheckConstraint` takes the boolean
	// expression as a `sql` fragment by design — there is no builder form for
	// a CHECK predicate. This restores the pre-#292 XOR invariant verbatim.
	await db.schema
		.alterTable("grade_target")
		.addCheckConstraint(
			"grade_target_kind_participant_check",
			sql`(kind = 'individual' AND student_row_id IS NOT NULL AND group_row_id IS NULL) OR (kind = 'group' AND group_row_id IS NOT NULL AND student_row_id IS NULL)`,
		)
		.execute();

	await db.schema
		.createIndex("grade_target_student_row_id_key")
		.unique()
		.on("grade_target")
		.column("student_row_id")
		.execute();
	await db.schema
		.createIndex("grade_target_group_row_id_key")
		.unique()
		.on("grade_target")
		.column("group_row_id")
		.execute();

	await db.schema.dropTable("grade_target_student").execute();

	await db.schema
		.alterTable("grade_target")
		.dropConstraint("grade_target_name_grid_row_id_key")
		.execute();
	await db.schema.alterTable("grade_target").dropColumn("name").execute();
}
