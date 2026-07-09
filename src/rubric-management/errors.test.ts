import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { RubricsValidationError, toRubricsValidationError } from "./errors.ts";

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn() } }));

vi.mock("#utils/logger.ts", () => ({ createLogger: () => mockLogger }));

describe("toRubricsValidationError", () => {
	it("returns the field/form errors carried by a RubricsValidationError", () => {
		const error = new RubricsValidationError({
			fieldErrors: { rubricId: "Rubric id is required." },
			formErrors: ["Something is wrong"],
		});

		const result = toRubricsValidationError(error);

		expect(result).toEqual({
			fieldErrors: { rubricId: "Rubric id is required." },
			formErrors: ["Something is wrong"],
		});
	});

	it("maps a ZodError into field/form errors", () => {
		const error = new ZodError([
			{
				code: "custom",
				path: ["confirmationText"],
				message: "Confirmation text is required",
				input: undefined,
			},
		]);

		const result = toRubricsValidationError(error);

		expect(result.fieldErrors.confirmationText).toBe(
			"Confirmation text is required",
		);
	});

	it("never leaks a raw internal error message for an unexpected error, and logs it once", () => {
		mockLogger.error.mockClear();
		const unexpectedError = new Error(
			"relation rubric_rowid_seq does not exist",
		);

		const result = toRubricsValidationError(unexpectedError);

		expect(result.formErrors).toHaveLength(1);
		expect(result.formErrors[0]).not.toContain("relation");
		expect(result.formErrors[0]).toMatch(/rubric/i);
		expect(result.formErrors[0]).toMatch(/try again|reload/i);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
	});

	it("handles a non-Error throw with a generic message and no leak", () => {
		const result = toRubricsValidationError(
			"a raw string thrown for some reason",
		);

		expect(result.formErrors).toHaveLength(1);
		expect(result.formErrors[0]).not.toContain("a raw string thrown");
	});
});
