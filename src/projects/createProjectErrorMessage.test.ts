import { describe, expect, it, vi } from "vitest";
import { toCreateProjectErrorMessage } from "./createProjectErrorMessage.ts";

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn() } }));

vi.mock("#utils/logger.ts", () => ({ createLogger: () => mockLogger }));

describe("toCreateProjectErrorMessage", () => {
	it("keeps the specific name-required message", () => {
		const error = new Error("Project name is required.");

		const message = toCreateProjectErrorMessage(error);

		expect(message).toMatch(/name is required/i);
	});

	it("never leaks a raw internal error message for an unexpected error, and logs it once", () => {
		mockLogger.error.mockClear();
		const unexpectedError = new Error(
			"duplicate key value violates unique constraint",
		);

		const message = toCreateProjectErrorMessage(unexpectedError);

		expect(message).not.toContain("duplicate key");
		expect(message).not.toContain("constraint");
		expect(message).toMatch(/project/i);
		expect(message).toMatch(/try again|reload/i);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
	});

	it("handles a non-Error throw with a generic message and no leak", () => {
		const message = toCreateProjectErrorMessage(
			"a raw string thrown for some reason",
		);

		expect(message).not.toContain("a raw string thrown");
	});
});
