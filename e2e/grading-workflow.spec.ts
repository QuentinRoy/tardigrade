import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { gridExportGradesPath, gridResultsPath } from "#grids/gridPaths.ts";
import {
	EXPECTED_COMPLETION,
	EXPECTED_CRITERION_ANALYTICS,
	EXPECTED_FINAL_TOTAL,
	EXPECTED_GRADE_MATRIX,
	GRID_NAME,
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

// Bulk imports invalidate the grid home's completion tags with
// stale-while-revalidate, not read-your-own-writes (see
// `src/db/cacheInvalidation.ts`): the grid home was already cached at "0 / 0"
// from the grid-creation redirect, so the very next load can still serve
// that stale value while a background refresh recomputes it. Poll with reloads
// until the refreshed value lands, rather than asserting on a single load.
async function expectCompletionEventually(
	page: Page,
	overviewUrl: string,
	expected: typeof EXPECTED_COMPLETION,
): Promise<void> {
	await expect(async () => {
		await page.goto(overviewUrl);
		await expectCompletion(
			page,
			"Students and groups graded",
			expected.gradeTargets,
		);
		await expectCompletion(page, "Rubrics graded", expected.rubrics);
		await expectCompletion(page, "Criteria graded", expected.criteria);
	}).toPass({ timeout: 15_000, intervals: [250, 500, 1000, 2000] });
}

// Capture every `<td>` in a table row as a trimmed array, so a whole row can
// be compared to an expected object in one assertion rather than one `getByText`
// per cell.
async function rowCellTexts(
	row: ReturnType<Page["getByRole"]>,
): Promise<string[]> {
	const cells = await row.locator("td").allTextContents();
	return cells.map((cell) => cell.trim());
}

async function expectCriterionAnalyticsRow(
	page: Page,
	expected: (typeof EXPECTED_CRITERION_ANALYTICS)[number],
): Promise<void> {
	const table = page.getByRole("table", { name: "Analytics" });
	const row = table.getByRole("row", { name: expected.criterionId });
	expect(await rowCellTexts(row)).toEqual([
		expected.rubricId,
		expected.criterionId,
		expected.average,
		`${expected.completion.completed} / ${expected.completion.total}`,
	]);
}

async function expectGradeMatrixRow(
	page: Page,
	expected: (typeof EXPECTED_GRADE_MATRIX)[number],
): Promise<void> {
	const table = page.getByRole("table", { name: "Grades" });
	const row = table.getByRole("row", { name: expected.label });
	expect(await rowCellTexts(row)).toEqual([
		expected.label,
		expected.cells.r1,
		expected.cells.r2,
		expected.total,
		`${expected.completion.completed} / ${expected.completion.total}`,
	]);
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

test("grading workflow: import, grade, persist, and export a computed total", async ({
	page,
}) => {
	// Create a grid and land on its overview.
	await page.goto("/grids");
	await page.getByLabel("Grid name").fill(GRID_NAME);
	await page.getByRole("button", { name: "Create and switch" }).click();
	await expect(page).toHaveURL(/\/grids\/[^/]+\/[^/]+$/);

	const [, , gridId, gridSlug] = new URL(page.url()).pathname.split("/");
	expect(gridId).toBeTruthy();
	expect(gridSlug).toBeTruthy();
	if (gridId == null || gridSlug == null) {
		throw new Error("Grid id and slug were not present in the overview URL.");
	}

	// Import in dependency order: rubrics define the rubric model, students
	// create the grade targets, grades are the grade source.
	await page.goto(`/grids/${gridId}/${gridSlug}/import/rubrics`);
	await importFixture(page, {
		fieldLabel: "Rubrics YAML",
		submitLabel: "Import rubrics",
		content: readFixture("rubrics.yaml"),
	});

	await page.goto(`/grids/${gridId}/${gridSlug}/import/students`);
	await importFixture(page, {
		fieldLabel: "Students CSV",
		submitLabel: "Import students",
		content: readFixture("students.csv"),
	});

	await page.goto(`/grids/${gridId}/${gridSlug}/import/grades`);
	await importFixture(page, {
		fieldLabel: "Grades CSV",
		submitLabel: "Import grades",
		content: readFixture("grades.csv"),
	});

	// Grade Completion on the overview: jane_smith is ungraded, so this
	// is a genuine partial state, not a trivial all-complete one.
	const overviewUrl = `/grids/${gridId}/${gridSlug}`;
	await expectCompletionEventually(page, overviewUrl, EXPECTED_COMPLETION);

	// Reload to prove the completion persisted: the writes survived in Postgres
	// and the production caches were invalidated after the imports.
	await page.reload();
	await expectCompletion(
		page,
		"Students and groups graded",
		EXPECTED_COMPLETION.gradeTargets,
	);

	// Visit the results page: it renders CriterionAnalyticsTable and
	// GradeMatrix, Server Components that use Mantine's Table.* compound
	// subcomponents. Those regressed with an RSC boundary crash ("Element type
	// is invalid") that no other check caught — tsc has no notion of the
	// client/server boundary, and this route isn't statically prerendered, so
	// only an actual render (here, or a real request) exercises it.
	await page.goto(gridResultsPath({ gridId, gridSlug }));
	await expect(page.getByRole("table", { name: "Analytics" })).toBeVisible();
	await expect(page.getByRole("table", { name: "Grades" })).toBeVisible();

	// Capture and compare every matrix cell, not just visibility: each row's
	// average and completion are computed roll-ups (see
	// `resultsBuilder.ts`), so this proves the aggregation itself, not
	// just that the page rendered something.
	for (const expected of EXPECTED_CRITERION_ANALYTICS) {
		await expectCriterionAnalyticsRow(page, expected);
	}
	for (const expected of EXPECTED_GRADE_MATRIX) {
		await expectGradeMatrixRow(page, expected);
	}

	// Export the grades CSV via the GET route (request context avoids
	// browser download flakiness) and assert the computed final totals. The
	// grid home shows completion only, so the numeric total is asserted here.
	const exportResponse = await page.request.get(
		gridExportGradesPath({ gridId, gridSlug }),
	);
	expect(exportResponse.ok()).toBe(true);

	const records = parseCsv(await exportResponse.text());
	const finalTotalByName = new Map(
		records.map((record) => [record["name"], record["final_total"]]),
	);

	for (const [name, expectedMarks] of Object.entries(EXPECTED_FINAL_TOTAL)) {
		const actual = finalTotalByName.get(name);
		if (expectedMarks == null) {
			// Not fully graded: the export leaves final_total blank.
			expect(actual).toBe("");
		} else {
			expect(actual).toBe(String(expectedMarks));
		}
	}
});
