"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
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
				<>
					<Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
						Assessments CSV
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						Required columns: <code>submission_type</code>,{" "}
						<code>submitter</code>.
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						Assessment columns use the format <code>questionId:rubricId</code>.
						For export/import round-trip, the exported CSV must include these
						assessment columns; marks-only columns are not importable assessment
						values. Values depend on rubric type: boolean uses <code>true</code>
						/<code>false</code>, ordinal uses a label value, and numerical uses
						a numeric score.
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						Empty assessment cells are ignored. Missing submissions are silently
						skipped. Columns for question totals, marks, and grand total marks
						are ignored.
					</Typography>
					<Box
						component="pre"
						sx={{
							bgcolor: "action.hover",
							borderRadius: 1,
							p: 2,
							fontSize: "0.8rem",
							overflowX: "auto",
							fontFamily: "monospace",
						}}
					>
						{ASSESSMENTS_CSV_PLACEHOLDER}
					</Box>
				</>
			}
		/>
	);
}
