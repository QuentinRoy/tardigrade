import { describe, expect, it } from "vitest";

import { createCsvGradeTargetExportDataStream } from "./gradeTargetExport.ts";
import type {
	ExportRubricPlan,
	GradeTargetExportDataRow,
} from "./gradeTargetExportCsv.ts";

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

describe("createCsvGradeTargetExportDataStream", () => {
	it("serializes nested camelCase rows using underscore CSV columns", async () => {
		const rubrics: ExportRubricPlan[] = [
			{
				id: "q1",
				criteria: [{ id: "r1", kind: "check", marks: 2, falseMarks: 0 }],
			},
		];

		async function* rows(): AsyncGenerator<GradeTargetExportDataRow> {
			yield {
				target: { id: "t-1", kind: "individual", studentId: "stu-1" },
				rubrics: [
					{
						rubricId: "q1",
						criteria: [{ criterionId: "r1", grade: true, marks: 2 }],
					},
				],
			};

			yield {
				target: { id: "t-2", kind: "individual", studentId: "stu-2" },
				rubrics: [{ rubricId: "q1", criteria: [{ criterionId: "r1" }] }],
			};
		}

		const stream = createCsvGradeTargetExportDataStream({
			rubrics,
			rows: rows(),
			options: { includeCriterionGrade: true, includeCriterionMarks: true },
		});
		const content = await readStream(stream);

		expect(content).toMatchInlineSnapshot(`
      "kind,name,q1:r1,q1:r1:marks,q1:total,final_total
      individual,stu-1,true,2,2,2
      individual,stu-2,,,,
      "
    `);
	});
});
