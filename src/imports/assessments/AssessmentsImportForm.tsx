"use client";

import { Code, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import BaseImportForm from "#imports/BaseImportForm.tsx";
import { ASSESSMENTS_CSV_PLACEHOLDER } from "#imports/constants.ts";
import type { ActionState } from "#utils/actionState.ts";

type AssessmentsImportFormProps = {
	defaultAssessmentsCsv?: string;
	action: (
		previousState: ActionState,
		formData: FormData,
	) => Promise<ActionState>;
};

export default function AssessmentsImportForm({
	action,
	defaultAssessmentsCsv,
}: AssessmentsImportFormProps): ReactElement {
	return (
		<BaseImportForm
			action={action}
			defaultValue={defaultAssessmentsCsv}
			title="Import Assessments"
			description="Load assessment data compatible with the CSV export format."
			fieldLabel="Assessments CSV"
			fieldName="assessmentsCsv"
			placeholder={ASSESSMENTS_CSV_PLACEHOLDER}
			minRows={12}
			submitLabel="Import assessments"
			helperText="Drop a .csv file here to fill this field"
			helpTitle="Assessments Import Format Reference"
			helpContent={
				<Stack gap="sm">
					<Text fw={600}>Assessments CSV</Text>
					<Text size="sm" c="dimmed">
						Required columns: <code>kind</code>, <code>name</code>.
					</Text>
					<Text size="sm" c="dimmed">
						Assessment columns use the format <code>rubricId:criterionId</code>.
						For export/import round-trip, the exported CSV must include these
						assessment columns; marks-only columns are not importable assessment
						values. Values depend on criterion kind: check uses{" "}
						<code>true</code>/<code>false</code>, options uses a label value,
						and number uses a numeric value.
					</Text>
					<Text size="sm" c="dimmed">
						Empty assessment cells are ignored. Rows for a student or group not
						found in this grid block the whole import. Columns for rubric
						totals, marks, and the final total are ignored.
					</Text>
					<Code block>{ASSESSMENTS_CSV_PLACEHOLDER}</Code>
				</Stack>
			}
		/>
	);
}
