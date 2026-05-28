import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createCsvSubmissionExportDataStream } from "./submissionExport";
import type {
  ExportQuestionPlan,
  SubmissionExportDataRow,
} from "./submissionExportCsv";

async function readStream(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let content = "";

  while (true) {
    const result = await reader.read();
    if (result.done) {
      break;
    }

    content += decoder.decode(result.value, { stream: true });
  }

  content += decoder.decode();
  return content;
}

describe("createCsvSubmissionExportDataStream", () => {
  it("serializes nested camelCase rows using underscore CSV columns", async () => {
    const questions: ExportQuestionPlan[] = [
      {
        id: "q1",
        rubrics: [
          {
            id: "r1",
            type: "boolean",
            marks: 2,
            falseMarks: 0,
          },
        ],
      },
    ];

    async function* rows(): AsyncGenerator<SubmissionExportDataRow> {
      yield {
        submission: {
          id: "sub-1",
          type: "individual",
          studentId: "stu-1",
        },
        questions: [
          {
            questionId: "q1",
            rubrics: [
              {
                rubricId: "r1",
                assessment: true,
                marks: 2,
              },
            ],
          },
        ],
      };

      yield {
        submission: {
          id: "sub-2",
          type: "individual",
          studentId: "stu-2",
        },
        questions: [
          {
            questionId: "q1",
            rubrics: [
              {
                rubricId: "r1",
              },
            ],
          },
        ],
      };
    }

    const stream = createCsvSubmissionExportDataStream({
      questions,
      rows: rows(),
      options: {
        includeRubricAssessment: true,
        includeRubricMarks: true,
      },
    });
    const content = await readStream(stream);

    expect(content).toMatchInlineSnapshot(`
      "submission_type,submitter,q1:r1,q1:r1:marks,q1,grand_total_marks
      individual,stu-1,true,2,2,2
      individual,stu-2,,,,
      "
    `);
  });
});
