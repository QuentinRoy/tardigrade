"use client";

import { Alert, Stack } from "@mantine/core";
import AppLink from "#design-system/AppLink.tsx";
import { useSaveErrors } from "#design-system/SaveErrorsProvider.tsx";
import { projectAssessmentSubmissionQuestionPath } from "#projects/projectPaths.ts";

export function SaveErrorsDisplay() {
	const { errors, dismissError } = useSaveErrors();

	if (errors.length === 0) return null;

	return (
		<Stack gap="xs">
			{errors.map((error) => (
				<Alert
					key={error.id}
					color="red"
					variant="filled"
					withCloseButton
					closeButtonLabel="Dismiss"
					onClose={() => dismissError(error.id)}
				>
					Failed to save assessment for{" "}
					<AppLink
						href={projectAssessmentSubmissionQuestionPath(error)}
						c="inherit"
						fw="bold"
					>
						{error.questionLabel ?? error.questionId} /{" "}
						{error.submissionLabel ?? error.submissionId}
					</AppLink>
					. {error.message}
				</Alert>
			))}
		</Stack>
	);
}
