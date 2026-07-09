import { execSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = "src/db/migrations/";

// Prefers origin/main because that's what a CI checkout actually has: it
// fetches remote branches as origin/* refs, not a local `main` branch (see
// .github/workflows/ci.yml). Falls back to a local `main` for local dev
// clones that track it directly.
function resolveBaseRef(): string {
	for (const ref of ["origin/main", "main"]) {
		try {
			execSync(`git rev-parse --verify ${ref}`, {
				stdio: "pipe",
				cwd: process.cwd(),
			});
			return ref;
		} catch {}
	}

	throw new Error(
		"Could not resolve 'origin/main' or 'main' to check migration immutability against. " +
			"This usually means the checkout is shallow and did not fetch main " +
			"(CI must use fetch-depth: 0, see .github/workflows/ci.yml). " +
			"Fix the checkout instead of skipping this check.",
	);
}

describe("Kysely migrations", () => {
	it("should not modify existing migrations compared to main", () => {
		const baseRef = resolveBaseRef();

		const baseMigrations = execSync(
			`git ls-tree -r --name-only ${baseRef} -- ${MIGRATIONS_DIR}`,
			{ encoding: "utf-8", cwd: process.cwd() },
		)
			.trim()
			.split("\n")
			.filter((line) => line.endsWith(".ts") && !line.endsWith("README.md"));

		const currentMigrations = execSync(
			`git ls-files ${MIGRATIONS_DIR} --cached --others --exclude-standard`,
			{ encoding: "utf-8", cwd: process.cwd() },
		)
			.trim()
			.split("\n")
			.filter(
				(line) =>
					line.length > 0 &&
					line.endsWith(".ts") &&
					!line.endsWith("README.md"),
			);

		const errors: string[] = [];

		for (const migration of baseMigrations) {
			if (!currentMigrations.includes(migration)) {
				errors.push(
					`Migration file ${migration} was deleted or renamed. Existing migrations are immutable and must not be deleted or renamed.`,
				);
				continue;
			}

			const baseContent = execSync(`git show ${baseRef}:${migration}`, {
				encoding: "utf-8",
				cwd: process.cwd(),
			});
			const currentContent = readFileSync(
				join(process.cwd(), migration),
				"utf-8",
			);

			const baseHash = createHash("sha256").update(baseContent).digest("hex");
			const currentHash = createHash("sha256")
				.update(currentContent)
				.digest("hex");

			if (baseHash !== currentHash) {
				errors.push(
					`Migration file ${migration} was modified. Existing migrations are immutable. Create a new migration instead of modifying existing ones.`,
				);
			}
		}

		// Migration order is append-only. A new migration must never sort before
		// an already-merged one: migrations run in filename order, so a
		// backdated/earlier-sorting file would be left unexecuted on any
		// environment that already ran the later migrations, silently skipping
		// it. Filenames are fixed-width timestamp-prefixed, so lexicographic
		// order is chronological order.
		let latestBaseMigration = "";
		for (const migration of baseMigrations) {
			if (migration > latestBaseMigration) {
				latestBaseMigration = migration;
			}
		}

		for (const migration of currentMigrations) {
			const isNewMigration = !baseMigrations.includes(migration);
			if (isNewMigration && migration < latestBaseMigration) {
				errors.push(
					`Migration file ${migration} sorts before the latest existing migration ${latestBaseMigration}. New migrations must be appended after all existing ones; do not insert a migration earlier in the sequence with a backdated filename.`,
				);
			}
		}

		if (errors.length > 0) {
			const message = `Immutable migration violations:\n${errors.map((error) => `  • ${error}`).join("\n")}`;
			expect.fail(message);
		}
	});
});
