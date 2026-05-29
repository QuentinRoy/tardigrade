import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { loadProjectByPublicId } from "@/db/projects";
import { loadQuestions } from "@/db/questions";
import { exportQuestionsToYaml } from "@/export/questionsExport";

type RouteParams = {
	params: Promise<{ projectId: string; projectSlug: string }>;
};

export async function GET(request: NextRequest, { params }: RouteParams) {
	const { projectId } = await params;
	const project = await loadProjectByPublicId(projectId);

	if (project == null) {
		return NextResponse.json({ error: "Project not found" }, { status: 404 });
	}

	try {
		const questions = await loadQuestions(project.id);
		const yaml = exportQuestionsToYaml(questions);

		const now = new Date();
		const dateString = now.toISOString().split("T")[0];
		const filename = `questions-export-${project.slug}-${dateString}.yaml`;

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
