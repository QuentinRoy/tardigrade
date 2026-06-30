"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import {
	type SaveError,
	useSaveErrors,
} from "#design-system/SaveErrorsProvider.tsx";
import { projectAssessmentSubmissionQuestionPath } from "#projects/projectPaths.ts";
import type { AssessedRubric } from "#rubrics/types.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import type { Submission } from "#submissions/types.ts";
import AssessmentProgressSummary from "./AssessmentProgressSummary.tsx";
import { summarizeRubrics } from "./assessmentSummary.ts";
import RubricGradeList from "./RubricGradeList.tsx";
import SubmissionQuickJumpDialog from "./SubmissionQuickJumpDialog.tsx";
import type { SaveAssessment } from "./saveRubricAssessment.ts";
import { saveRubricAssessment } from "./saveRubricAssessment.ts";
import { getSubmissionNavigation } from "./submissionNavigation.ts";
import { useAssessmentSession } from "./useAssessmentSession.ts";
import { useSubmissionQuickJump } from "./useSubmissionQuickJump.ts";

type SubmissionAssessmentClientProps = {
	projectId: string;
	projectSlug: string;
	questionId: string;
	questionLabel?: string | undefined;
	rubrics: AssessedRubric[];
	submissions: Submission[];
	progressPromise: Promise<
		Record<string, { completed: number; total: number }>
	>;
	currentSubmissionId: string;
	// Injected rather than imported, so this component never statically
	// imports the "use server" saveAssessment module. The page passes the
	// real server action; stories pass a plain stub.
	saveAssessment: SaveAssessment;
};

export default function SubmissionAssessmentClient({
	projectId,
	projectSlug,
	questionId,
	questionLabel,
	rubrics: initialRubrics,
	submissions,
	progressPromise,
	currentSubmissionId,
	saveAssessment,
}: SubmissionAssessmentClientProps): ReactElement {
	const router = useRouter();
	const { addError } = useSaveErrors();
	const quickJump = useSubmissionQuickJump();

	const { currentSubmission } = getSubmissionNavigation(
		submissions,
		currentSubmissionId,
	);
	const currentSubmissionLabel =
		currentSubmission != null
			? getSubmissionLabel(currentSubmission)
			: undefined;

	const {
		currentSubmissionIndex,
		previousSubmission,
		nextSubmission,
		savedRubrics,
		optimisticRubrics,
		pendingByIndex,
		assess,
	} = useAssessmentSession<Omit<SaveError, "id">>({
		initialRubrics,
		submissions,
		currentSubmissionId,
		saveRubric: (_rubric, rubric) =>
			saveRubricAssessment({
				saveAssessment,
				submissionId: currentSubmissionId,
				questionId,
				rubric,
				errorContext: {
					projectId,
					projectSlug,
					submissionId: currentSubmissionId,
					submissionLabel: currentSubmissionLabel,
					questionId,
					questionLabel,
				},
			}),
		onError: addError,
	});

	const { marks, maxMarks, completedRubrics, totalRubrics } =
		summarizeRubrics(optimisticRubrics);
	const isCompleted = totalRubrics > 0 && completedRubrics === totalRubrics;

	const navigateToSubmission = (submissionId: string) => {
		router.push(
			projectAssessmentSubmissionQuestionPath({
				projectId,
				projectSlug,
				submissionId,
				questionId,
			}),
		);
	};

	if (currentSubmission == null) {
		return (
			<Typography variant="body1" sx={{ mb: 3 }}>
				No submissions found in database.
			</Typography>
		);
	}

	return (
		<>
			<Box
				sx={{
					mb: 2,
					p: 2,
					border: "1px solid",
					borderColor: "divider",
					borderRadius: 1,
				}}
			>
				<Typography variant="subtitle2" color="text.secondary">
					Current submission
				</Typography>
				<Typography variant="h6">
					{getSubmissionLabel(currentSubmission)}
				</Typography>
				<Typography variant="body2" color="text.secondary">
					{currentSubmission.id}
				</Typography>
			</Box>

			<Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
				<Button
					component={NextLink}
					href={projectAssessmentSubmissionQuestionPath({
						projectId,
						projectSlug,
						submissionId: previousSubmission?.id ?? currentSubmissionId,
						questionId,
					})}
					prefetch={previousSubmission != null}
					variant="outlined"
					color={isCompleted ? "primary" : "secondary"}
					disabled={previousSubmission == null}
				>
					Previous submission
				</Button>
				<Button
					component={NextLink}
					href={projectAssessmentSubmissionQuestionPath({
						projectId,
						projectSlug,
						submissionId: nextSubmission?.id ?? currentSubmissionId,
						questionId,
					})}
					prefetch={nextSubmission != null}
					variant="outlined"
					color={isCompleted ? "primary" : "secondary"}
					disabled={nextSubmission == null}
				>
					Next submission
				</Button>
				<Button variant="contained" onClick={quickJump.open}>
					Lookup
				</Button>
				<Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
					{currentSubmissionIndex + 1} / {submissions.length}
				</Typography>
			</Box>

			<SubmissionQuickJumpDialog
				open={quickJump.isOpen}
				onClose={quickJump.close}
				onSelectSubmission={navigateToSubmission}
				submissions={submissions}
				progressPromise={progressPromise}
				progressLabel="rubrics"
			/>

			<RubricGradeList
				savedRubrics={savedRubrics}
				rubrics={optimisticRubrics}
				pendingByIndex={pendingByIndex}
				disabled={false}
				onAssess={(index, assessment) => assess(index, assessment)}
			/>

			<AssessmentProgressSummary
				marks={marks}
				maxMarks={maxMarks}
				completedRubrics={completedRubrics}
				totalRubrics={totalRubrics}
			/>
		</>
	);
}
