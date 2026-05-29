import { randomUUID } from "node:crypto";
import { type Generated, type Kysely, sql } from "kysely";

const DEFAULT_PROJECT_NAME = "Default";
const DEFAULT_PROJECT_PUBLIC_ID = `p-${randomUUID().slice(0, 8)}`;

const tablesWithProjectEntries = (
	["question", "rubric", "student", "team", "submission", "assessment"] as const
).map((table) => ({
	table,
	constraint:
		`${table?.[0]?.toUpperCase() + table.slice(1)}_projectId_fkey` as const,
	index: `${table}_project_id_idx` as const,
}));

type TableWithProjectName = (typeof tablesWithProjectEntries)[number]["table"];

type MigrationDB = {
	project: { id: Generated<number>; public_id: string; name: string };
} & Record<TableWithProjectName, { project_id: number | null }>;

async function addProjectIdColumn({
	db,
	table,
	defaultProjectId,
	constraint,
}: {
	db: Kysely<MigrationDB>;
	table: TableWithProjectName;
	defaultProjectId: number;
	constraint: string;
}): Promise<void> {
	await db.schema
		.alterTable(table)
		.addColumn("project_id", "integer")
		.execute();

	await db
		.updateTable(table)
		.set({ project_id: defaultProjectId })
		.where("project_id", "is", null)
		.execute();

	await db.schema
		.alterTable(table)
		.alterColumn("project_id", (column) => column.setNotNull())
		.execute();

	await db.schema
		.alterTable(table)
		.addForeignKeyConstraint(
			constraint,
			["project_id"],
			"project",
			["id"],
			(constraint) => constraint.onDelete("cascade").onUpdate("cascade"),
		)
		.execute();

	await db.schema
		.createIndex(`${table}_project_id_idx`)
		.on(table)
		.column("project_id")
		.execute();
}

export async function up(db: Kysely<MigrationDB>): Promise<void> {
	await db.schema
		.createTable("project")
		.addColumn("id", "integer", (column) =>
			column.generatedAlwaysAsIdentity().primaryKey().notNull(),
		)
		.addColumn("public_id", "text", (column) => column.notNull().unique())
		.addColumn("name", "text", (column) => column.notNull())
		.addColumn("created_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.addColumn("updated_at", "timestamp(3)", (column) =>
			column.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
		)
		.execute();

	const defaultProjectId = await db
		.insertInto("project")
		.values({
			public_id: DEFAULT_PROJECT_PUBLIC_ID,
			name: DEFAULT_PROJECT_NAME,
		})
		.returning("id")
		.executeTakeFirstOrThrow()
		.then((row) => row.id);

	if (defaultProjectId == null) {
		throw new Error("Default project could not be resolved in migration.");
	}

	await Promise.all(
		tablesWithProjectEntries.map((table) =>
			addProjectIdColumn({ db, defaultProjectId, ...table }),
		),
	);

	await db.schema
		.alterTable("student")
		.addUniqueConstraint("Student_projectId_id_key", ["project_id", "id"])
		.execute();

	await db.schema.alterTable("team").dropConstraint("team_name_key").execute();

	await db.schema
		.alterTable("team")
		.addUniqueConstraint("Team_name_projectId_key", ["name", "project_id"])
		.execute();
}

export async function down(db: Kysely<MigrationDB>): Promise<void> {
	await Promise.all(
		tablesWithProjectEntries.map(async ({ table, index }) => {
			await db.schema.dropIndex(index).execute();
			await db.schema.alterTable(table).dropColumn("project_id").execute();
		}),
	);

	await db.schema.dropTable("project").ifExists().execute();

	await db.schema
		.alterTable("student")
		.dropConstraint("Student_projectId_id_key")
		.execute();

	await db.schema
		.alterTable("team")
		.dropConstraint("Team_name_projectId_key")
		.execute();

	await db.schema
		.alterTable("team")
		.addUniqueConstraint("team_name_key", ["name"])
		.execute();
}
