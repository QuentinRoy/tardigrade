import "server-only";
import { type NextRequest, NextResponse } from "next/server";
import { loadQuestions } from "@/db/questions";
import { exportQuestionsToYaml } from "@/export/questionsExport";

export async function GET(request: NextRequest) {
  try {
    const questions = await loadQuestions();
    const yaml = exportQuestionsToYaml(questions);

    const now = new Date();
    const dateString = now.toISOString().split("T")[0];
    const filename = `questions-export-${dateString}.yaml`;

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
