import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { projectExportSubmissionsPath } from "#projects/projectPaths.ts";
import {
	EXPECTED_COMPLETION,
	EXPECTED_GRAND_TOTAL_MARKS,
	PROJECT_NAME,
} from "./fixtures/expectations.ts";

// One narrow happy-path smoke test: it drives a realistic grading workflow
// through a real browser against a real Postgres, exercising the layers that
// only integrate at runtime — browser UI, Next.js server actions/routes,
// database persistence, production cache invalidation, the computed grading
// roll-ups, and import/export. Edge cases stay in unit and integration tests.
// Selectors are accessible-first (`getByRole` / `getByLabel`); a missing
// accessible name is treated as a real a11y gap to fix at the source.

function readFixture(name: string): string {
	return readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
}

// Imports are multiline text areas, not file inputs (see
// `src/import/BaseImportForm.tsx`): fill the field, submit, and wait for the
// success alert. While importing, the button reads "Importing..." and is
// disabled, so the success alert is the reliable signal, not the button.
async function importFixture(
	page: Page,
	{
		fieldLabel,
		submitLabel,
		content,
	}: { fieldLabel: string; submitLabel: string; content: string },
): Promise<void> {
	await page.getByLabel(fieldLabel).fill(content);
	await page.getByRole("button", { name: submitLabel }).click();
	// Every import success message starts with "Imported …"; an error renders a
	// different alert, so this asserts success specifically. Scope past Next's
	// route announcer, which also has `role="alert"` but no matching text.
	await expect(
		page.getByRole("alert").filter({ hasText: "Imported" }),
	).toBeVisible();
}

async function expectCompletion(
	page: Page,
	title: string,
	{ completed, total }: { completed: number; total: number },
): Promise<void> {
	const card = page.getByRole("group", { name: title });
	// MetricCard renders "completed / total" (non-breaking spaces), so
	// match on the digits with flexible whitespace rather than a literal " / ".
	await expect(
		card.getByText(new RegExp(`${completed}\\s*/\\s*${total}`)),
	).toBeVisible();
}

// Bulk imports invalidate the dashboard's completion tags with
// stale-while-revalidate, not read-your-own-writes (see
// `src/db/cacheInvalidation.ts`): the dashboard was already cached at "0 / 0"
// from the project-creation redirect, so the very next load can still serve
// that stale value while a background refresh recomputes it. Poll with reloads
// until the refreshed value lands, rather than asserting on a single load.
async function expectCompletionEventually(
	page: Page,
	dashboardUrl: string,
	expected: typeof EXPECTED_COMPLETION,
): Promise<void> {
	await expect(async () => {
		await page.goto(dashboardUrl);
		await expectCompletion(page, "Submissions assessed", expected.submissions);
		await expectCompletion(page, "Questions assessed", expected.questions);
		await expectCompletion(page, "Rubrics assessed", expected.rubrics);
	}).toPass({ timeout: 15_000, intervals: [250, 500, 1000, 2000] });
}

// Minimal CSV reader covering quoted fields and embedded separators, so the
// export assertions stay correct even if a future fixture adds a comma.
function parseCsvRows(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let index = 0; index < text.length; index += 1) {
		const char = text[index];
		if (inQuotes) {
			if (char === '"' && text[index + 1] === '"') {
				field += '"';
				index += 1;
			} else if (char === '"') {
				inQuotes = false;
			} else {
				field += char;
			}
			continue;
		}
		if (char === '"') {
			inQuotes = true;
		} else if (char === ",") {
			row.push(field);
			field = "";
		} else if (char === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (char !== "\r") {
			field += char;
		}
	}
	if (field !== "" || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows;
}

function parseCsv(text: string): Record<string, string>[] {
	const rows = parseCsvRows(text);
	const header = rows[0];
	if (header == null) {
		return [];
	}
	return rows.slice(1).map((cells) => {
		const record: Record<string, string> = {};
		header.forEach((name, columnIndex) => {
			record[name] = cells[columnIndex] ?? "";
		});
		return record;
	});
}

test("grading workflow: import, assess, persist, and export a computed total", async ({
	page,
}) => {
	// Create a project and land on its dashboard.
	await page.goto("/projects");
	await page.getByLabel("Project name").fill(PROJECT_NAME);
	await page.getByRole("button", { name: "Create and switch" }).click();
	await expect(page).toHaveURL(/\/projects\/[^/]+\/[^/]+$/);

	const [, , projectId, projectSlug] = new URL(page.url()).pathname.split("/");
	expect(projectId).toBeTruthy();
	expect(projectSlug).toBeTruthy();
	if (projectId == null || projectSlug == null) {
		throw new Error(
			"Project id and slug were not present in the dashboard URL.",
		);
	}

	// Import in dependency order: questions define the rubric model, students
	// create the submissions, assessments are the grade source.
	await page.goto(`/projects/${projectId}/${projectSlug}/import/questions`);
	await importFixture(page, {
		fieldLabel: "Questions YAML",
		submitLabel: "Import questions",
		content: readFixture("questions.yaml"),
	});

	await page.goto(`/projects/${projectId}/${projectSlug}/import/students`);
	await importFixture(page, {
		fieldLabel: "Students CSV",
		submitLabel: "Import students",
		content: readFixture("students.csv"),
	});

	await page.goto(`/projects/${projectId}/${projectSlug}/import/assessments`);
	await importFixture(page, {
		fieldLabel: "Assessments CSV",
		submitLabel: "Import assessments",
		content: readFixture("assessments.csv"),
	});

	// Assessment Completion on the dashboard: jane_smith is unassessed, so this
	// is a genuine partial state, not a trivial all-complete one.
	const dashboardUrl = `/projects/${projectId}/${projectSlug}`;
	await expectCompletionEventually(page, dashboardUrl, EXPECTED_COMPLETION);

	// Reload to prove the completion persisted: the writes survived in Postgres
	// and the production caches were invalidated after the imports.
	await page.reload();
	await expectCompletion(
		page,
		"Submissions assessed",
		EXPECTED_COMPLETION.submissions,
	);

	// Export the submissions CSV via the GET route (request context avoids
	// browser download flakiness) and assert the computed grand totals. The
	// dashboard shows completion only, so the numeric total is asserted here.
	const exportResponse = await page.request.get(
		projectExportSubmissionsPath({ projectId, projectSlug }),
	);
	expect(exportResponse.ok()).toBe(true);

	const records = parseCsv(await exportResponse.text());
	const grandTotalBySubmitter = new Map(
		records.map((record) => [record["submitter"], record["grand_total_marks"]]),
	);

	for (const [submitter, expectedMarks] of Object.entries(
		EXPECTED_GRAND_TOTAL_MARKS,
	)) {
		const actual = grandTotalBySubmitter.get(submitter);
		if (expectedMarks == null) {
			// Not fully assessed: the export leaves grand_total_marks blank.
			expect(actual).toBe("");
		} else {
			expect(actual).toBe(String(expectedMarks));
		}
	}
});
