import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	invalidateGradeImport,
	invalidateGradeSave,
	invalidateProjectCreate,
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

function updatedTags(): string[] {
	return vi.mocked(updateTag).mock.calls.map((call) => call[0]);
}

function revalidatedTags(): string[] {
	return vi.mocked(revalidateTag).mock.calls.map((call) => call[0]);
}

test("invalidateGradeSave updates the edited tags and revalidates the derived tags", () => {
	invalidateGradeSave({ targetId: "t-1", rubricId: "q-1" });

	expect(updatedTags()).toEqual(["grades:t-1:q-1", "grades:t-1"]);
	expect(revalidatedTags()).toEqual(["grades", "grades:rubric:q-1"]);
});

test("invalidateRubricDefinitionSave updates the rubric list and revalidates grade tags", () => {
	invalidateRubricDefinitionSave({ rubricId: "q-1" });

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidatedTags()).toEqual([
		"grades",
		"grades:all",
		"grades:rubric:q-1",
	]);
});

test("invalidateRubricDefinitionSave revalidates the previous rubric's completion when the id changes", () => {
	invalidateRubricDefinitionSave({ rubricId: "q-2", previousRubricId: "q-1" });

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidatedTags()).toEqual([
		"grades",
		"grades:all",
		"grades:rubric:q-2",
		"grades:rubric:q-1",
	]);
});

test("invalidateRubricDefinitionSave ignores an unchanged previous id", () => {
	invalidateRubricDefinitionSave({ rubricId: "q-1", previousRubricId: "q-1" });

	expect(revalidatedTags()).toEqual([
		"grades",
		"grades:all",
		"grades:rubric:q-1",
	]);
});

test("invalidateRubricDefinitionDelete updates the rubric list and revalidates grade tags", () => {
	invalidateRubricDefinitionDelete({ rubricId: "q-1" });

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidatedTags()).toEqual([
		"grades",
		"grades:all",
		"grades:rubric:q-1",
	]);
});

test("invalidateRubricReorder only updates the rubric list read-your-writes", () => {
	invalidateRubricReorder();

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidateTag).not.toHaveBeenCalled();
});

test("invalidateProjectCreate revalidates the project list and the new project tag", () => {
	invalidateProjectCreate({ projectId: "p-1" });

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual(["projects", "projects:p-1"]);
});

test("invalidateGradeImport revalidates the grade aggregates", () => {
	invalidateGradeImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual(["grades", "grades:all"]);
});

test("invalidateRubricImport revalidates the rubric list and grade aggregates", () => {
	invalidateRubricImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual(["rubrics", "grades", "grades:all"]);
});

test("invalidateStudentImport revalidates the grade-target list and grade aggregates", () => {
	invalidateStudentImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual(["grade-targets", "grades", "grades:all"]);
});

test("import and project helpers revalidate with the max profile", () => {
	invalidateProjectCreate({ projectId: "p-1" });
	invalidateGradeImport();
	invalidateRubricImport();
	invalidateStudentImport();

	const profiles = vi.mocked(revalidateTag).mock.calls.map((call) => call[1]);
	expect(profiles.every((profile) => profile === "max")).toBe(true);
});
