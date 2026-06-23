import { buildDatedFilename } from "#export/exportFilename.ts";
import { createCsvSubmissionExport } from "#export/submissionExport.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { createLogger } from "#utils/logger.ts";
import { parseExportOptions } from "./exportOptions.ts";

const logger = createLogger("export");

type RouteParams = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

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

	let options: ReturnType<typeof parseExportOptions>;
	try {
		options = parseExportOptions(searchParams);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request";
		return Response.json({ error: message }, { status: 400 });
	}

	try {
		const body = await createCsvSubmissionExport(options, project.id);

		const filename = buildDatedFilename({
			baseName: `submission-assessments-${project.slug}`,
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
		logger.error({ err: error }, "Failed to export submissions");
		const message =
			error instanceof Error ? error.message : "Failed to export submissions";
		return Response.json({ error: message }, { status: 500 });
	}
}
