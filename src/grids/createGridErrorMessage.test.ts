import { describe, expect, it, vi } from "vitest";
import { toCreateGridErrorMessage } from "./createGridErrorMessage.ts";

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn() } }));

vi.mock("#utils/logger.ts", () => ({ createLogger: () => mockLogger }));

describe("toCreateGridErrorMessage", () => {
	it("keeps the specific name-required message", () => {
		const error = new Error("Grid name is required.");

		const message = toCreateGridErrorMessage(error);

		expect(message).toMatch(/name is required/i);
	});

	it("never leaks a raw internal error message for an unexpected error, and logs it once", () => {
		mockLogger.error.mockClear();
		const unexpectedError = new Error(
			"duplicate key value violates unique constraint",
		);

		const message = toCreateGridErrorMessage(unexpectedError);

		expect(message).not.toContain("duplicate key");
		expect(message).not.toContain("constraint");
		expect(message).toMatch(/grid/i);
		expect(message).toMatch(/try again|reload/i);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
	});

	it("handles a non-Error throw with a generic message and no leak", () => {
		const message = toCreateGridErrorMessage(
			"a raw string thrown for some reason",
		);

		expect(message).not.toContain("a raw string thrown");
	});
});
