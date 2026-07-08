import { beforeEach, describe, expect, it, vi } from "vitest";

const loadProjectByPublicId = vi.fn();
const createCsvSubmissionExport = vi.fn();
const loggerError = vi.fn();

vi.mock("#projects/projects.ts", () => ({
	loadProjectByPublicId: (...args: unknown[]) => loadProjectByPublicId(...args),
}));

vi.mock("#export/submissionExport.ts", () => ({
	createCsvSubmissionExport: (...args: unknown[]) =>
		createCsvSubmissionExport(...args),
}));

vi.mock("#utils/logger.ts", () => ({
	createLogger: () => ({ error: (...args: unknown[]) => loggerError(...args) }),
}));

import { GET } from "./route.ts";

const params = Promise.resolve({
	projectId: "project-1",
	projectSlug: "intro-to-grading",
});

function buildRequest(query = ""): Request {
	return new Request(
		`https://example.test/projects/project-1/intro-to-grading/export/submissions${query}`,
	);
}

function csvStream(): ReadableStream<Uint8Array> {
	return new ReadableStream({
		start(controller) {
			controller.enqueue(new TextEncoder().encode("a,b\n1,2\n"));
			controller.close();
		},
	});
}

describe("GET /export/submissions", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 404 with an error body when the project is not found", async () => {
		loadProjectByPublicId.mockResolvedValue(undefined);

		const response = await GET(buildRequest(), { params });

		expect(response.status).toBe(404);
		await expect(response.json()).resolves.toEqual({
			error: "Project not found",
		});
		expect(createCsvSubmissionExport).not.toHaveBeenCalled();
	});

	it("returns 400 with an error body when the query options are invalid", async () => {
		loadProjectByPublicId.mockResolvedValue({
			id: "project-1",
			slug: "intro-to-grading",
			name: "Intro to Grading",
		});

		const response = await GET(buildRequest("?include=not-a-real-option"), {
			params,
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toEqual({
			error: "Invalid include option: not-a-real-option",
		});
		expect(createCsvSubmissionExport).not.toHaveBeenCalled();
	});

	it("returns a 200 CSV stream with dated filename, content-type, and no-store cache-control", async () => {
		loadProjectByPublicId.mockResolvedValue({
			id: "project-1",
			slug: "intro-to-grading",
			name: "Intro to Grading",
		});
		createCsvSubmissionExport.mockResolvedValue(csvStream());

		const response = await GET(buildRequest(), { params });

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"text/csv; charset=utf-8",
		);
		expect(response.headers.get("cache-control")).toBe("no-store");
		const disposition = response.headers.get("content-disposition");
		expect(disposition).toMatch(
			/^attachment; filename="submission-assessments-intro-to-grading-\d{4}-\d{2}-\d{2}\.csv"$/,
		);
		expect(createCsvSubmissionExport).toHaveBeenCalledWith(
			{ includeCriterionAssessment: false, includeCriterionMarks: false },
			"project-1",
		);
	});

	it("parses repeated include params and passes the options to the export", async () => {
		loadProjectByPublicId.mockResolvedValue({
			id: "project-1",
			slug: "intro-to-grading",
			name: "Intro to Grading",
		});
		createCsvSubmissionExport.mockResolvedValue(csvStream());

		const response = await GET(
			buildRequest(
				"?include=criterion-assessment&include=criterion-marks&include=criterion-assessment",
			),
			{ params },
		);

		expect(response.status).toBe(200);
		expect(createCsvSubmissionExport).toHaveBeenCalledWith(
			{ includeCriterionAssessment: true, includeCriterionMarks: true },
			"project-1",
		);
	});

	it("returns 500 with an error body and logs when the export throws", async () => {
		loadProjectByPublicId.mockResolvedValue({
			id: "project-1",
			slug: "intro-to-grading",
			name: "Intro to Grading",
		});
		createCsvSubmissionExport.mockRejectedValue(new Error("db exploded"));

		const response = await GET(buildRequest(), { params });

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: "db exploded" });
		expect(loggerError).toHaveBeenCalledTimes(1);
	});
});
