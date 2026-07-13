import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteRubricDefinition = vi.fn();
const saveRubricDefinition = vi.fn();
const reorderRubrics = vi.fn();

vi.mock("./rubricDefinitionMutations.ts", () => ({
	deleteRubricDefinition: (...args: unknown[]) =>
		deleteRubricDefinition(...args),
	saveRubricDefinition: (...args: unknown[]) => saveRubricDefinition(...args),
	reorderRubrics: (...args: unknown[]) => reorderRubrics(...args),
}));

import { deleteRubricAction } from "./actions.ts";
import { initialRubricsActionState } from "./state.ts";

function buildDeleteFormData(rubricId: string): FormData {
	const formData = new FormData();
	formData.set(
		"payload",
		JSON.stringify({
			rubricId,
			confirmationText: "confirm",
			expectedPhrase: "confirm",
		}),
	);
	return formData;
}

describe("deleteRubricAction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns a success message when a rubric is deleted", async () => {
		deleteRubricDefinition.mockResolvedValue({ deleted: true });

		const result = await deleteRubricAction(
			"project-1",
			initialRubricsActionState,
			buildDeleteFormData("q1"),
		);

		expect(result).toEqual({
			status: "success",
			message: "Deleted rubric q1.",
		});
	});

	it("returns a neutral no-op message when nothing was deleted", async () => {
		deleteRubricDefinition.mockResolvedValue({ deleted: false });

		const result = await deleteRubricAction(
			"project-1",
			initialRubricsActionState,
			buildDeleteFormData("q1"),
		);

		expect(result).toEqual({
			status: "success",
			message: "Rubric q1 was already removed.",
		});
	});

	it("does not include grade counts in the delete response", async () => {
		deleteRubricDefinition.mockResolvedValue({ deleted: true });

		const result = await deleteRubricAction(
			"project-1",
			initialRubricsActionState,
			buildDeleteFormData("q1"),
		);

		expect(result.message).not.toMatch(/grade/i);
		expect(result).not.toHaveProperty("gradedTargetCount");
	});

	it("returns an error state when the confirmation phrase does not match", async () => {
		const formData = new FormData();
		formData.set(
			"payload",
			JSON.stringify({
				rubricId: "q1",
				confirmationText: "nope",
				expectedPhrase: "confirm",
			}),
		);

		const result = await deleteRubricAction(
			"project-1",
			initialRubricsActionState,
			formData,
		);

		expect(result.status).toBe("error");
		expect(deleteRubricDefinition).not.toHaveBeenCalled();
	});
});
