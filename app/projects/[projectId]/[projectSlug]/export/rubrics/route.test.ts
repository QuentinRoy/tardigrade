import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadProjectByPublicId = vi.fn();
const loadRubricsById = vi.fn();
const exportRubricsToYaml = vi.fn();
const loggerError = vi.fn();

vi.mock("#projects/projects.ts", () => ({
	loadProjectByPublicId: (...args: unknown[]) => loadProjectByPublicId(...args),
}));

vi.mock("#rubrics/rubrics.ts", () => ({
	loadRubricsById: (...args: unknown[]) => loadRubricsById(...args),
}));

vi.mock("#export/rubricsExport.ts", () => ({
	exportRubricsToYaml: (...args: unknown[]) => exportRubricsToYaml(...args),
}));

vi.mock("#utils/logger.ts", () => ({
	createLogger: () => ({ error: (...args: unknown[]) => loggerError(...args) }),
}));

import { GET } from "./route.ts";

const params = Promise.resolve({
	projectId: "project-1",
	projectSlug: "intro-to-grading",
});

function buildRequest(): NextRequest {
	return new NextRequest(
		"https://example.test/projects/project-1/intro-to-grading/export/rubrics",
	);
}

describe("GET /export/rubrics", () => {
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
		expect(loadRubricsById).not.toHaveBeenCalled();
	});

	it("returns a 200 YAML body with dated filename and content-type", async () => {
		loadProjectByPublicId.mockResolvedValue({
			id: "project-1",
			slug: "intro-to-grading",
			name: "Intro to Grading",
		});
		loadRubricsById.mockResolvedValue({});
		exportRubricsToYaml.mockReturnValue("rubrics: []\n");

		const response = await GET(buildRequest(), { params });

		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(
			"application/yaml; charset=utf-8",
		);
		const disposition = response.headers.get("content-disposition");
		expect(disposition).toMatch(
			/^attachment; filename="rubrics-export-intro-to-grading-\d{4}-\d{2}-\d{2}\.yaml"$/,
		);
		await expect(response.text()).resolves.toBe("rubrics: []\n");
	});

	it("returns 500 with an error body when loading rubrics throws", async () => {
		loadProjectByPublicId.mockResolvedValue({
			id: "project-1",
			slug: "intro-to-grading",
			name: "Intro to Grading",
		});
		loadRubricsById.mockRejectedValue(new Error("db exploded"));

		const response = await GET(buildRequest(), { params });

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({ error: "db exploded" });
		expect(loggerError).toHaveBeenCalledTimes(1);
	});
});
