import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Kysely migrations", () => {
	it("should not modify existing migrations compared to main", () => {
		// Get list of migration files from main branch
		let mainMigrations: string[];

		try {
			const output = execSync(
				"git ls-tree -r --name-only main -- src/db/migrations/",
				{
					encoding: "utf-8",
					stdio: ["pipe", "pipe", "pipe"],
					cwd: process.cwd(),
				},
			);
			mainMigrations = output
				.trim()
				.split("\n")
				.filter((line) => line.endsWith(".ts") && !line.endsWith("README.md"));
		} catch {
			// If main branch doesn't exist (e.g., new repo, no git history),
			// skip the test gracefully
			return;
		}

		// Get list of migration files from current branch
		let currentMigrations: string[];

		try {
			const output = execSync(
				"git ls-files src/db/migrations/ --cached --others --exclude-standard",
				{ encoding: "utf-8", cwd: process.cwd() },
			);
			currentMigrations = output
				.trim()
				.split("\n")
				.filter(
					(line) =>
						line.length > 0 &&
						line.endsWith(".ts") &&
						!line.endsWith("README.md"),
				);
		} catch {
			// No git repo, skip
			return;
		}

		const errors: string[] = [];

		// Check for deleted or renamed migrations
		for (const mainMigration of mainMigrations) {
			if (!currentMigrations.includes(mainMigration)) {
				// Migration was deleted or renamed
				errors.push(
					`Migration file ${mainMigration} was deleted or renamed. Existing migrations are immutable and must not be deleted or renamed.`,
				);
			} else {
				// Check if migration content was modified
				try {
					const mainContent = execSync(`git show main:${mainMigration}`, {
						encoding: "utf-8",
						cwd: process.cwd(),
					});
					const currentContent = readFileSync(
						join(process.cwd(), mainMigration),
						"utf-8",
					);

					const mainHash = createHash("sha256")
						.update(mainContent)
						.digest("hex");
					const currentHash = createHash("sha256")
						.update(currentContent)
						.digest("hex");

					if (mainHash !== currentHash) {
						errors.push(
							`Migration file ${mainMigration} was modified. Existing migrations are immutable. Create a new migration instead of modifying existing ones.`,
						);
					}
				} catch {
					// If we can't read the file, it might be staged but not committed.
					// This is allowed (e.g., new migrations), so skip.
				}
			}
		}

		if (errors.length > 0) {
			const message = `Immutable migration violations:\n${errors.map((e) => `  • ${e}`).join("\n")}`;
			expect.fail(message);
		}
	});
});
