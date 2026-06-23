import { describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";
import { toImportErrorState } from "./actionUtils.ts";
import { ImportBlockedError } from "./importErrors.ts";

const { mockLogger } = vi.hoisted(() => ({ mockLogger: { error: vi.fn() } }));

vi.mock("#utils/logger.ts", () => ({ createLogger: () => mockLogger }));

describe("toImportErrorState", () => {
	it("prettifies a ZodError into a readable message", () => {
		const zodError = new ZodError([
			{
				code: "custom",
				path: ["rows", 0, "score"],
				message: "Expected a number",
				input: undefined,
			},
		]);

		const state = toImportErrorState(zodError);

		expect(state.status).toBe("error");
		expect(state.errors?.[0]).toContain("Expected a number");
	});

	it("keeps the message of an ImportBlockedError unchanged", () => {
		const blockedError = new ImportBlockedError(
			'Assessment import errors:\nUnrecognized column: "foo"\nNothing was imported. Fix the listed issues and retry.',
		);

		const state = toImportErrorState(blockedError);

		expect(state.status).toBe("error");
		expect(state.errors?.[0]).toBe(blockedError.message);
	});

	it("never leaks a raw internal error message for an unexpected error, and logs it once", () => {
		mockLogger.error.mockClear();
		const unexpectedError = new Error("ECONNRESET: connection reset");

		const state = toImportErrorState(unexpectedError);

		expect(state.status).toBe("error");
		expect(state.errors?.[0]).not.toContain("ECONNRESET");
		expect(state.errors?.[0]).toMatch(/import/i);
		expect(state.errors?.[0]).toMatch(/try again|reload/i);
		expect(mockLogger.error).toHaveBeenCalledTimes(1);
	});

	it("handles a non-Error throw with a generic message and no leak", () => {
		const state = toImportErrorState("a raw string thrown for some reason");

		expect(state.status).toBe("error");
		expect(state.errors?.[0]).not.toContain("a raw string thrown");
	});
});
