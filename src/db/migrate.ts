import { promises as fs } from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { Pool } from "pg";
import type { DB } from "./generated/db.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createDb() {
	const connectionString = process.env["DATABASE_URL"];

	if (connectionString == null || connectionString.length === 0) {
		throw new Error("DATABASE_URL is required to run migrations");
	}

	return new Kysely<DB>({
		dialect: new PostgresDialect({ pool: new Pool({ connectionString }) }),
	});
}

const db = createDb();

function writeLine(message: string) {
	process.stdout.write(`${message}\n`);
}

function writeError(message: string) {
	process.stderr.write(`${message}\n`);
}

function createMigrator() {
	return new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: path.join(__dirname, "migrations"),
		}),
	});
}

async function runUp() {
	const migrator = createMigrator();
	const { error, results } = await migrator.migrateToLatest();

	for (const result of results ?? []) {
		writeLine(`[${result.status}] ${result.migrationName}`);
	}

	if (error != null) {
		throw error;
	}
}

async function runDown() {
	const migrator = createMigrator();
	const { error, results } = await migrator.migrateDown();

	for (const result of results ?? []) {
		writeLine(`[${result.status}] ${result.migrationName}`);
	}

	if (error != null) {
		throw error;
	}
}

async function hardConfirm(
	question: string,
	expectedAnswer: string,
): Promise<boolean> {
	const rl = createInterface({ input: process.stdin, output: process.stdout });

	return new Promise((resolve) => {
		rl.question(
			`${question}\nType "${expectedAnswer}" to confirm: `,
			(answer) => {
				rl.close();
				resolve(expectedAnswer.trim() === answer.trim());
			},
		);
	});
}

async function runReset() {
	const dbUrl = process.env["DATABASE_URL"];
	if (dbUrl == null || dbUrl.length === 0) {
		throw new Error("DATABASE_URL is required");
	}

	const confirmed = await hardConfirm(
		`This will permanently delete all data in the database.`,
		"delete all data",
	);

	if (!confirmed) {
		writeLine("Aborted.");
		return;
	}

	const url = new URL(dbUrl);
	const dbName = url.pathname.slice(1);

	// Connect to the default postgres database to drop the target
	url.pathname = "/postgres";
	const adminPool = new Pool({ connectionString: url.toString() });

	try {
		await adminPool.query(`DROP DATABASE IF EXISTS "${dbName}"`);
		writeLine(`Database "${dbName}" dropped.`);
		await adminPool.query(`CREATE DATABASE "${dbName}"`);
		writeLine(`Database "${dbName}" recreated.`);
	} finally {
		await adminPool.end();
	}
}

async function runStatus() {
	const migrator = createMigrator();
	const results = await migrator.getMigrations();

	for (const result of results) {
		const status = result.executedAt == null ? "pending" : "executed";
		writeLine(`[${status}] ${result.name}`);
	}
}

async function main() {
	const command = process.argv[2];

	if (command === "up") {
		await runUp();
		return;
	}

	if (command === "down") {
		await runDown();
		return;
	}

	if (command === "status") {
		await runStatus();
		return;
	}

	if (command === "reset") {
		await runReset();
		return;
	}

	throw new Error(
		'Unknown command. Use one of: "up", "down", "status", "reset".',
	);
}

main()
	.catch((error) => {
		const message = error instanceof Error ? error.message : String(error);
		writeError(message);
		process.exitCode = 1;
	})
	.finally(async () => {
		await db.destroy();
	});
