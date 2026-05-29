"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useState } from "react";
import { projectAssessmentSubmissionQuestionPath } from "@/projects/projectPaths";
import type { AssessedRubric } from "@/rubrics/rubric";
import type { AssessmentRubricValue, Submission } from "../db/types";
import { type SaveError, useSaveErrors } from "../shared/SaveErrorsProvider";
import { getSubmissionLabel } from "../submissions/getSubmissionLabel";
import AssessmentProgressSummary from "./AssessmentProgressSummary";
import { summarizeRubrics } from "./assessmentSummary";
import RubricGradeList from "./RubricGradeList";
import SubmissionQuickJumpDialog from "./SubmissionQuickJumpDialog";
import { saveAssessment } from "./saveAssessment";
import { useAssessmentSession } from "./useAssessmentSession";

type SubmissionAssessmentClientProps = {
	projectId: string;
	projectSlug: string;
	questionId: string;
	questionLabel?: string;
	rubrics: AssessedRubric[];
	submissions: Submission[];
	progressBySubmissionId: Record<string, { completed: number; total: number }>;
	currentSubmissionId: string;
};

export default function SubmissionAssessmentClient({
	projectId,
	projectSlug,
	questionId,
	questionLabel,
	rubrics: initialRubrics,
	submissions,
	progressBySubmissionId,
	currentSubmissionId,
}: SubmissionAssessmentClientProps): ReactElement {
	const router = useRouter();
	const { addError } = useSaveErrors();
	const [isQuickJumpOpen, setQuickJumpOpen] = useState(false);
	const currentSubmission = submissions.find(
		(submission) => submission.id === currentSubmissionId,
	);
	const currentSubmissionLabel =
		currentSubmission != null
			? getSubmissionLabel(currentSubmission)
			: undefined;

	const {
		currentSubmissionIndex,
		currentSubmission: sessionCurrentSubmission,
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
		saveRubric: async (
			_rubric: AssessedRubric,
			rubric: AssessmentRubricValue,
		) => {
			const result = await saveAssessment({
				submissionId: currentSubmissionId,
				questionId,
				rubric,
			});
			if (result.success) {
				return { success: true };
			}
			return {
				success: false,
				error: {
					projectId,
					projectSlug,
					submissionId: currentSubmissionId,
					submissionLabel: currentSubmissionLabel,
					questionId,
					questionLabel,
					message: result.error,
				},
			};
		},
		onError: addError,
	});

	const { marks, maxMarks, completedRubrics, totalRubrics } =
		summarizeRubrics(optimisticRubrics);
	const isCompleted = totalRubrics > 0 && completedRubrics === totalRubrics;

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const key = event.key.toLowerCase();
			const isShortcut = (event.metaKey || event.ctrlKey) && key === "k";

			if (!isShortcut) {
				return;
			}

			const target = event.target;
			if (target instanceof HTMLElement) {
				const tagName = target.tagName.toLowerCase();
				if (
					target.isContentEditable ||
					tagName === "input" ||
					tagName === "textarea"
				) {
					return;
				}
			}

			event.preventDefault();
			setQuickJumpOpen(true);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	const navigateToSubmission = (submissionId: string) => {
		router.push(
			projectAssessmentSubmissionQuestionPath(
				projectId,
				projectSlug,
				submissionId,
				questionId,
			),
		);
	};

	if (sessionCurrentSubmission == null || currentSubmission == null) {
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
					href={projectAssessmentSubmissionQuestionPath(
						projectId,
						projectSlug,
						previousSubmission?.id ?? currentSubmissionId,
						questionId,
					)}
					prefetch={previousSubmission != null}
					variant="outlined"
					color={isCompleted ? "primary" : "secondary"}
					disabled={previousSubmission == null}
				>
					Previous submission
				</Button>
				<Button
					component={NextLink}
					href={projectAssessmentSubmissionQuestionPath(
						projectId,
						projectSlug,
						nextSubmission?.id ?? currentSubmissionId,
						questionId,
					)}
					prefetch={nextSubmission != null}
					variant="outlined"
					color={isCompleted ? "primary" : "secondary"}
					disabled={nextSubmission == null}
				>
					Next submission
				</Button>
				<Button variant="contained" onClick={() => setQuickJumpOpen(true)}>
					Lookup
				</Button>
				<Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
					{currentSubmissionIndex + 1} / {submissions.length}
				</Typography>
			</Box>

			<SubmissionQuickJumpDialog
				open={isQuickJumpOpen}
				onClose={() => setQuickJumpOpen(false)}
				onSelectSubmission={navigateToSubmission}
				submissions={submissions}
				progressBySubmissionId={progressBySubmissionId}
				progressLabel="rubrics"
			/>

			<RubricGradeList
				savedRubrics={savedRubrics}
				rubrics={optimisticRubrics}
				pendingByIndex={pendingByIndex}
				disabled={sessionCurrentSubmission == null}
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
