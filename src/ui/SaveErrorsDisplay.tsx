"use client";

import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import NextLink from "next/link";
import { projectAssessmentSubmissionQuestionPath } from "#projects/projectPaths.ts";
import { useSaveErrors } from "./SaveErrorsProvider.tsx";

export function SaveErrorsDisplay() {
	const { errors, dismissError } = useSaveErrors();

	if (errors.length === 0) return null;

	return (
		<Box
			sx={{
				position: "fixed",
				bottom: 16,
				left: 16,
				zIndex: 2000,
				display: "flex",
				flexDirection: "column",
				gap: 1,
				maxWidth: 480,
			}}
		>
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
						href={projectAssessmentSubmissionQuestionPath(
							error.projectId,
							error.projectSlug,
							error.submissionId,
							error.questionId,
						)}
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
