import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	invalidateAssessmentImport,
	invalidateAssessmentSave,
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

test("invalidateAssessmentSave updates the edited tags and revalidates the derived tags", () => {
	invalidateAssessmentSave({ submissionId: "s-1", rubricId: "q-1" });

	expect(updatedTags()).toEqual(["assessments:s-1:q-1", "assessments:s-1"]);
	expect(revalidatedTags()).toEqual(["assessments", "assessments:rubric:q-1"]);
});

test("invalidateRubricDefinitionSave updates the rubric list and revalidates assessment tags", () => {
	invalidateRubricDefinitionSave({ rubricId: "q-1" });

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:rubric:q-1",
	]);
});

test("invalidateRubricDefinitionSave revalidates the previous rubric's progress when the id changes", () => {
	invalidateRubricDefinitionSave({ rubricId: "q-2", previousRubricId: "q-1" });

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:rubric:q-2",
		"assessments:rubric:q-1",
	]);
});

test("invalidateRubricDefinitionSave ignores an unchanged previous id", () => {
	invalidateRubricDefinitionSave({ rubricId: "q-1", previousRubricId: "q-1" });

	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:rubric:q-1",
	]);
});

test("invalidateRubricDefinitionDelete updates the rubric list and revalidates assessment tags", () => {
	invalidateRubricDefinitionDelete({ rubricId: "q-1" });

	expect(updatedTags()).toEqual(["rubrics"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:rubric:q-1",
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

test("invalidateAssessmentImport revalidates the assessment aggregates", () => {
	invalidateAssessmentImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual(["assessments", "assessments:all"]);
});

test("invalidateRubricImport revalidates the rubric list and assessment aggregates", () => {
	invalidateRubricImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual([
		"rubrics",
		"assessments",
		"assessments:all",
	]);
});

test("invalidateStudentImport revalidates the submission list and assessment aggregates", () => {
	invalidateStudentImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual([
		"submissions",
		"assessments",
		"assessments:all",
	]);
});

test("import and project helpers revalidate with the max profile", () => {
	invalidateProjectCreate({ projectId: "p-1" });
	invalidateAssessmentImport();
	invalidateRubricImport();
	invalidateStudentImport();

	const profiles = vi.mocked(revalidateTag).mock.calls.map((call) => call[1]);
	expect(profiles.every((profile) => profile === "max")).toBe(true);
});
