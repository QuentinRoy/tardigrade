import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { buildDatedFilename } from "#export/exportFilename.ts";
import { exportQuestionsToYaml } from "#export/questionsExport.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadQuestionGrid } from "#questions/questions.ts";

type RouteParams = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export async function GET(_request: NextRequest, { params }: RouteParams) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId);

	if (project == null) {
		return NextResponse.json({ error: "Project not found" }, { status: 404 });
	}

	try {
		const questions = await loadQuestionGrid({ projectId: project.id });
		const yaml = exportQuestionsToYaml(questions);

		const filename = buildDatedFilename({
			baseName: `questions-export-${project.slug}`,
			extension: "yaml",
		});

		return new NextResponse(yaml, {
			status: 200,
			headers: {
				"Content-Type": "application/yaml; charset=utf-8",
				"Content-Disposition": `attachment; filename="${filename}"`,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to export questions",
			},
			{ status: 500 },
		);
	}
}
