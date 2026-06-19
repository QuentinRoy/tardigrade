import type { Kysely } from "kysely";

const projectForeignKeys = [
	{ table: "assessment", constraint: "Assessment_projectId_fkey" },
	{ table: "question", constraint: "Question_projectId_fkey" },
	{ table: "rubric", constraint: "Rubric_projectId_fkey" },
	{ table: "student", constraint: "Student_projectId_fkey" },
	{ table: "submission", constraint: "Submission_projectId_fkey" },
	{ table: "team", constraint: "Team_projectId_fkey" },
] as const;

export async function up(db: Kysely<unknown>): Promise<void> {
	await Promise.all(
		projectForeignKeys.map(({ table, constraint }) =>
			db.schema.alterTable(table).dropConstraint(constraint).execute(),
		),
	);

	await db.schema
		.alterTable("project")
		.dropConstraint("project_pkey")
		.execute();
	await db.schema
		.alterTable("project")
		.dropConstraint("project_public_id_key")
		.execute();

	await db.schema.alterTable("project").renameColumn("id", "row_id").execute();
	await db.schema
		.alterTable("project")
		.renameColumn("public_id", "id")
		.execute();

	await db.schema
		.alterTable("project")
		.addPrimaryKeyConstraint("project_pkey", ["row_id"])
		.execute();
	await db.schema
		.alterTable("project")
		.addUniqueConstraint("project_id_key", ["id"])
		.execute();

	await Promise.all(
		projectForeignKeys.map(({ table, constraint }) =>
			db.schema
				.alterTable(table)
				.addForeignKeyConstraint(
					constraint,
					["project_id"],
					"project",
					["row_id"],
					(foreignKey) => foreignKey.onDelete("cascade").onUpdate("cascade"),
				)
				.execute(),
		),
	);
}

export async function down(db: Kysely<unknown>): Promise<void> {
	await Promise.all(
		projectForeignKeys.map(({ table, constraint }) =>
			db.schema.alterTable(table).dropConstraint(constraint).execute(),
		),
	);

	await db.schema
		.alterTable("project")
		.dropConstraint("project_pkey")
		.execute();
	await db.schema
		.alterTable("project")
		.dropConstraint("project_id_key")
		.execute();

	await db.schema
		.alterTable("project")
		.renameColumn("id", "public_id")
		.execute();
	await db.schema.alterTable("project").renameColumn("row_id", "id").execute();

	await db.schema
		.alterTable("project")
		.addPrimaryKeyConstraint("project_pkey", ["id"])
		.execute();
	await db.schema
		.alterTable("project")
		.addUniqueConstraint("project_public_id_key", ["public_id"])
		.execute();

	await Promise.all(
		projectForeignKeys.map(({ table, constraint }) =>
			db.schema
				.alterTable(table)
				.addForeignKeyConstraint(
					constraint,
					["project_id"],
					"project",
					["id"],
					(foreignKey) => foreignKey.onDelete("cascade").onUpdate("cascade"),
				)
				.execute(),
		),
	);
}
