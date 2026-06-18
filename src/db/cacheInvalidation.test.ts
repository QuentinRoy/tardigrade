import { revalidateTag, updateTag } from "next/cache";
import { beforeEach, expect, test, vi } from "vitest";
import {
	invalidateAssessmentImport,
	invalidateAssessmentSave,
	invalidateProjectCreate,
	invalidateQuestionDefinitionDelete,
	invalidateQuestionDefinitionSave,
	invalidateQuestionImport,
	invalidateQuestionReorder,
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
	invalidateAssessmentSave({ submissionId: "s-1", questionId: "q-1" });

	expect(updatedTags()).toEqual(["assessments:s-1:q-1", "assessments:s-1"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:question:q-1",
	]);
});

test("invalidateQuestionDefinitionSave updates the question list and revalidates assessment tags", () => {
	invalidateQuestionDefinitionSave({ questionId: "q-1" });

	expect(updatedTags()).toEqual(["questions"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:question:q-1",
	]);
});

test("invalidateQuestionDefinitionSave revalidates the previous question's progress when the id changes", () => {
	invalidateQuestionDefinitionSave({
		questionId: "q-2",
		previousQuestionId: "q-1",
	});

	expect(updatedTags()).toEqual(["questions"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:question:q-2",
		"assessments:question:q-1",
	]);
});

test("invalidateQuestionDefinitionSave ignores an unchanged previous id", () => {
	invalidateQuestionDefinitionSave({
		questionId: "q-1",
		previousQuestionId: "q-1",
	});

	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:question:q-1",
	]);
});

test("invalidateQuestionDefinitionDelete updates the question list and revalidates assessment tags", () => {
	invalidateQuestionDefinitionDelete({ questionId: "q-1" });

	expect(updatedTags()).toEqual(["questions"]);
	expect(revalidatedTags()).toEqual([
		"assessments",
		"assessments:all",
		"assessments:question:q-1",
	]);
});

test("invalidateQuestionReorder only updates the question list read-your-writes", () => {
	invalidateQuestionReorder();

	expect(updatedTags()).toEqual(["questions"]);
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

test("invalidateQuestionImport revalidates the question list and assessment aggregates", () => {
	invalidateQuestionImport();

	expect(updateTag).not.toHaveBeenCalled();
	expect(revalidatedTags()).toEqual([
		"questions",
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
	invalidateQuestionImport();
	invalidateStudentImport();

	const profiles = vi.mocked(revalidateTag).mock.calls.map((call) => call[1]);
	expect(profiles.every((profile) => profile === "max")).toBe(true);
});
