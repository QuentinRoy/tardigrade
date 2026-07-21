import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	invalidateGradeImport,
	invalidateGradeSave,
	invalidateGridCreate,
	invalidateRubricDefinitionDelete,
	invalidateRubricDefinitionSave,
	invalidateRubricImport,
	invalidateRubricReorder,
	invalidateStudentImport,
} from "./cacheInvalidation.ts";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), updateTag: vi.fn() }));

beforeEach(() => {
	vi.clearAllMocks();
});

// The tags each mutation busts, and whether via `updateTag` (read-your-writes)
// or `revalidateTag` (stale-while-revalidate), are pinned with inline snapshots:
// a shape or primitive change fails here (both silently break freshness), while
// a deliberate change is a one-line `vitest -u`.
function updatedTags(): string[] {
	return vi.mocked(updateTag).mock.calls.map((call) => call[0]);
}

function revalidatedTags(): string[] {
	return vi.mocked(revalidateTag).mock.calls.map((call) => call[0]);
}

test("invalidateGradeSave updates the edited tags and revalidates the derived tags", () => {
	invalidateGradeSave({ gridId: "g-1", targetId: "t-1", rubricId: "q-1" });

	expect(updatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades:target:t-1",
		]
	`);
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades",
		  "grids:g-1:grades:rubric:q-1",
		]
	`);
});

test("invalidateRubricDefinitionSave updates the rubric list and revalidates grade tags", () => {
	invalidateRubricDefinitionSave({ gridId: "g-1", rubricId: "q-1" });

	expect(updatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:rubrics",
		]
	`);
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades",
		  "grids:g-1:grades:rubric:q-1",
		]
	`);
});

test("invalidateRubricDefinitionSave revalidates the previous rubric's completion when the id changes", () => {
	invalidateRubricDefinitionSave({
		gridId: "g-1",
		rubricId: "q-2",
		previousRubricId: "q-1",
	});

	expect(updatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:rubrics",
		]
	`);
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades",
		  "grids:g-1:grades:rubric:q-2",
		  "grids:g-1:grades:rubric:q-1",
		]
	`);
});

test("invalidateRubricDefinitionSave ignores an unchanged previous id", () => {
	invalidateRubricDefinitionSave({
		gridId: "g-1",
		rubricId: "q-1",
		previousRubricId: "q-1",
	});

	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades",
		  "grids:g-1:grades:rubric:q-1",
		]
	`);
});

test("invalidateRubricDefinitionDelete updates the rubric list and revalidates grade tags", () => {
	invalidateRubricDefinitionDelete({ gridId: "g-1", rubricId: "q-1" });

	expect(updatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:rubrics",
		]
	`);
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades",
		  "grids:g-1:grades:rubric:q-1",
		]
	`);
});

test("invalidateRubricReorder only updates the rubric list read-your-writes", () => {
	invalidateRubricReorder({ gridId: "g-1" });

	expect(updatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:rubrics",
		]
	`);
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("invalidateGridCreate revalidates the grid list and the new grid tag", () => {
	invalidateGridCreate({ gridId: "g-1" });

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids",
		  "grids:g-1",
		]
	`);
});

test("invalidateGradeImport revalidates the grade aggregates", () => {
	invalidateGradeImport({ gridId: "g-1" });

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grades",
		]
	`);
});

test("invalidateRubricImport revalidates the rubric list and grade aggregates", () => {
	invalidateRubricImport({ gridId: "g-1" });

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:rubrics",
		  "grids:g-1:grades",
		]
	`);
});

test("invalidateStudentImport revalidates the grade-target list and grade aggregates", () => {
	invalidateStudentImport({ gridId: "g-1" });

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toMatchInlineSnapshot(`
		[
		  "grids:g-1:grade-targets",
		  "grids:g-1:grades",
		]
	`);
});

test("import and grid helpers revalidate with the max profile", () => {
	invalidateGridCreate({ gridId: "g-1" });
	invalidateGradeImport({ gridId: "g-1" });
	invalidateRubricImport({ gridId: "g-1" });
	invalidateStudentImport({ gridId: "g-1" });

	const profiles = vi.mocked(revalidateTag).mock.calls.map((call) => call[1]);
	expect(profiles.every((profile) => profile === "max")).toBe(true);
});
