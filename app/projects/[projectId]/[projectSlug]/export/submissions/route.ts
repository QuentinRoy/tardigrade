import { buildDatedFilename } from "#export/exportFilename.ts";
import { createCsvSubmissionExport } from "#export/submissionExport.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { parseExportOptions } from "./exportOptions.ts";

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

	let options;
	try {
		options = parseExportOptions(searchParams);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Invalid request";
		return Response.json({ error: message }, { status: 400 });
	}

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
}
