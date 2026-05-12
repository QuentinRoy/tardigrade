"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { type ReactElement } from "react";
import { assessmentsImportAction } from "./assessmentsImportAction";
import BaseImportForm from "./BaseImportForm";
import { ASSESSMENTS_CSV_PLACEHOLDER } from "./constants";

type AssessmentsImportFormProps = {
  defaultAssessmentsCsv?: string;
};

export default function AssessmentsImportForm({
  defaultAssessmentsCsv,
}: AssessmentsImportFormProps): ReactElement {
  return (
    <BaseImportForm
      action={assessmentsImportAction}
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
            Required columns: <code>submissionId</code>,{" "}
            <code>submissionType</code>, <code>submitter</code>.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Assessment columns use the format <code>questionId:rubricId</code>.
            Values depend on rubric type: boolean uses <code>true</code>/
            <code>false</code>, ordinal uses a label value, and numerical uses a
            numeric score.
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
