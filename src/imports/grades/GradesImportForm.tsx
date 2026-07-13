"use client";

import { Code, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import BaseImportForm from "#imports/BaseImportForm.tsx";
import { GRADES_CSV_PLACEHOLDER } from "#imports/constants.ts";
import type { ActionState } from "#utils/actionState.ts";

type GradesImportFormProps = {
	defaultGradesCsv?: string;
	action: (
		previousState: ActionState,
		formData: FormData,
	) => Promise<ActionState>;
};

export default function GradesImportForm({
	action,
	defaultGradesCsv,
}: GradesImportFormProps): ReactElement {
	return (
		<BaseImportForm
			action={action}
			defaultValue={defaultGradesCsv}
			title="Import Grades"
			description="Load grade data compatible with the CSV export format."
			fieldLabel="Grades CSV"
			fieldName="gradesCsv"
			placeholder={GRADES_CSV_PLACEHOLDER}
			minRows={12}
			submitLabel="Import grades"
			helperText="Drop a .csv file here to fill this field"
			helpTitle="Grades Import Format Reference"
			helpContent={
				<Stack gap="sm">
					<Text fw={600}>Grades CSV</Text>
					<Text size="sm" c="dimmed">
						Required columns: <code>kind</code>, <code>name</code>.
					</Text>
					<Text size="sm" c="dimmed">
						Grade columns use the format <code>rubricId:criterionId</code>. For
						export/import round-trip, the exported CSV must include these grade
						columns; marks-only columns are not importable grade values. Values
						depend on criterion kind: check uses <code>true</code>/
						<code>false</code>, options uses a label value, and number uses a
						numeric value.
					</Text>
					<Text size="sm" c="dimmed">
						Empty grade cells are ignored. Rows for a student or group not found
						in this grid block the whole import. Columns for rubric totals,
						marks, and the final total are ignored.
					</Text>
					<Code block>{GRADES_CSV_PLACEHOLDER}</Code>
				</Stack>
			}
		/>
	);
}
