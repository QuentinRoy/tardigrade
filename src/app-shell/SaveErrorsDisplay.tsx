"use client";

import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import NextLink from "next/link";
import { useSaveErrors } from "#design-system/SaveErrorsProvider.tsx";
import { projectAssessmentSubmissionQuestionPath } from "#projects/projectPaths.ts";

export function SaveErrorsDisplay() {
	const { errors, dismissError } = useSaveErrors();

	if (errors.length === 0) return null;

	return (
		<Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
			{errors.map((error) => (
				<MuiAlert
					key={error.id}
					severity="error"
					elevation={6}
					variant="filled"
					onClose={() => dismissError(error.id)}
				>
					Failed to save assessment for{" "}
					<Link
						component={NextLink}
						href={projectAssessmentSubmissionQuestionPath(error)}
						color="inherit"
						sx={{ fontWeight: "bold" }}
					>
						{error.questionLabel ?? error.questionId} /{" "}
						{error.submissionLabel ?? error.submissionId}
					</Link>
					. {error.message}
				</MuiAlert>
			))}
		</Box>
	);
}
