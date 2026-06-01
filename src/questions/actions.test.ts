import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const deleteQuestionDefinition = vi.fn();
const saveQuestionDefinition = vi.fn();
const reorderQuestions = vi.fn();

vi.mock("#db/questionDefinitionMutations.ts", () => ({
	deleteQuestionDefinition: (...args: unknown[]) =>
		deleteQuestionDefinition(...args),
	saveQuestionDefinition: (...args: unknown[]) =>
		saveQuestionDefinition(...args),
	reorderQuestions: (...args: unknown[]) => reorderQuestions(...args),
}));

import { deleteQuestionAction } from "./actions.ts";
import { initialQuestionsActionState } from "./state.ts";

function buildDeleteFormData(questionId: string): FormData {
	const formData = new FormData();
	formData.set(
		"payload",
		JSON.stringify({
			questionId,
			confirmationText: "confirm",
			expectedPhrase: "confirm",
		}),
	);
	return formData;
}

describe("deleteQuestionAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a success message when a question is deleted", async () => {
		deleteQuestionDefinition.mockResolvedValue({ deleted: true });

		const result = await deleteQuestionAction(
			"project-1",
			initialQuestionsActionState,
			buildDeleteFormData("q1"),
		);

		expect(result).toEqual({
			status: "success",
			message: "Deleted question q1.",
		});
	});

	it("returns a neutral no-op message when nothing was deleted", async () => {
		deleteQuestionDefinition.mockResolvedValue({ deleted: false });

		const result = await deleteQuestionAction(
			"project-1",
			initialQuestionsActionState,
			buildDeleteFormData("q1"),
		);

		expect(result).toEqual({
			status: "success",
			message: "Question q1 was already removed.",
		});
	});

	it("does not include assessment counts in the delete response", async () => {
		deleteQuestionDefinition.mockResolvedValue({ deleted: true });

		const result = await deleteQuestionAction(
			"project-1",
			initialQuestionsActionState,
			buildDeleteFormData("q1"),
		);

		expect(result.message).not.toMatch(/assessment/i);
		expect(result).not.toHaveProperty("assessmentCount");
	});

	it("returns an error state when the confirmation phrase does not match", async () => {
		const formData = new FormData();
		formData.set(
			"payload",
			JSON.stringify({
				questionId: "q1",
				confirmationText: "nope",
				expectedPhrase: "confirm",
			}),
		);

		const result = await deleteQuestionAction(
			"project-1",
			initialQuestionsActionState,
			formData,
		);

		expect(result.status).toBe("error");
		expect(deleteQuestionDefinition).not.toHaveBeenCalled();
	});
});
