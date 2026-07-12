import { buildDatedFilename } from "#export/exportFilename.ts";
import { createCsvGradeTargetExport } from "#export/gradeTargetExport.ts";
import type { ExportOptions } from "#export/gradeTargetExportCsv.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { createLogger } from "#utils/logger.ts";

const logger = createLogger("export");

type RouteParams = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

// Reads the export's `include` query params. Route-internal: the only caller is
// GET below, and its parsing contract is covered through the route tests.
function parseExportOptions(searchParams: URLSearchParams): ExportOptions {
	const includeSet = new Set<"criterion-assessment" | "criterion-marks">();
	for (const include of searchParams.getAll("include")) {
		if (include !== "criterion-assessment" && include !== "criterion-marks") {
			throw new Error(`Invalid include option: ${include}`);
		}
		includeSet.add(include);
	}

	return {
		includeCriterionAssessment: includeSet.has("criterion-assessment"),
		includeCriterionMarks: includeSet.has("criterion-marks"),
	};
}

export async function GET(
	request: Request,
	{ params }: RouteParams,
): Promise<Response> {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId);

	if (project == null) {
		return Response.json({ error: "Project not found" }, { status: 404 });
	}

	const searchParams = new URL(request.url).searchParams;

	let options: ExportOptions;
	try {
		options = parseExportOptions(searchParams);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request";
		return Response.json({ error: message }, { status: 400 });
	}

	try {
		const body = await createCsvGradeTargetExport(options, project.id);

		const filename = buildDatedFilename({
			baseName: `grades-${project.slug}`,
			extension: "csv",
		});

		return new Response(body, {
			headers: {
				"content-type": "text/csv; charset=utf-8",
				"content-disposition": `attachment; filename="${filename}"`,
				"cache-control": "no-store",
			},
		});
	} catch (error) {
		logger.error({ err: error }, "Failed to export grades");
		const message =
			error instanceof Error ? error.message : "Failed to export grades";
		return Response.json({ error: message }, { status: 500 });
	}
}
