"use client";

import { Button, Card, Group, Stack, Text, Title } from "@mantine/core";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import type { AssessedCriterion } from "#criteria/types.ts";
import {
	type SaveError,
	useSaveErrors,
} from "#design-system/SaveErrorsProvider.tsx";
import { projectAssessmentSubmissionRubricPath } from "#projects/projectPaths.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import type { Submission } from "#submissions/types.ts";
import AssessmentProgressSummary from "./AssessmentProgressSummary.tsx";
import { summarizeCriteria } from "./assessmentSummary.ts";
import CriterionGradeList from "./CriterionGradeList.tsx";
import SubmissionSelector from "./SubmissionSelector.tsx";
import type { SaveAssessment } from "./saveCriterionAssessment.ts";
import { saveCriterionAssessment } from "./saveCriterionAssessment.ts";
import { getSubmissionNavigation } from "./submissionNavigation.ts";
import { useAssessmentSession } from "./useAssessmentSession.ts";
import { useSubmissionQuickJump } from "./useSubmissionQuickJump.ts";

type SubmissionAssessmentClientProps = {
	projectId: string;
	projectSlug: string;
	rubricId: string;
	rubricLabel?: string | undefined;
	criteria: AssessedCriterion[];
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
	rubricId,
	rubricLabel,
	criteria: initialCriteria,
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
		savedCriteria,
		optimisticCriteria,
		pendingByIndex,
		assess,
	} = useAssessmentSession<Omit<SaveError, "id">>({
		initialCriteria,
		submissions,
		currentSubmissionId,
		saveAssessment: (_criterion, assessment) =>
			saveCriterionAssessment({
				saveAssessment,
				submissionId: currentSubmissionId,
				rubricId,
				assessment,
				errorContext: {
					projectId,
					projectSlug,
					submissionId: currentSubmissionId,
					submissionLabel: currentSubmissionLabel,
					rubricId,
					rubricLabel,
				},
			}),
		onError: addError,
	});

	const { marks, maxMarks, completedCriteria, totalCriteria } =
		summarizeCriteria(optimisticCriteria);
	const isCompleted = totalCriteria > 0 && completedCriteria === totalCriteria;

	const navigateToSubmission = (submissionId: string) => {
		router.push(
			projectAssessmentSubmissionRubricPath({
				projectId,
				projectSlug,
				submissionId,
				rubricId,
			}),
		);
	};

	if (currentSubmission == null) {
		return <Text>No submissions found in database.</Text>;
	}

	return (
		<Stack gap="xl">
			<Card withBorder padding="md">
				<Text size="sm" c="dimmed">
					Current submission
				</Text>
				<Title order={3}>{getSubmissionLabel(currentSubmission)}</Title>
				<Text size="sm" c="dimmed">
					{currentSubmission.id}
				</Text>
			</Card>
			<Group gap="xs" wrap="wrap">
				<Button
					component={NextLink}
					href={projectAssessmentSubmissionRubricPath({
						projectId,
						projectSlug,
						submissionId: previousSubmission?.id ?? currentSubmissionId,
						rubricId,
					})}
					prefetch={previousSubmission != null}
					variant="outline"
					{...(!isCompleted && { color: "gray" })}
					disabled={previousSubmission == null}
				>
					Previous submission
				</Button>
				<Button
					component={NextLink}
					href={projectAssessmentSubmissionRubricPath({
						projectId,
						projectSlug,
						submissionId: nextSubmission?.id ?? currentSubmissionId,
						rubricId,
					})}
					prefetch={nextSubmission != null}
					variant="outline"
					{...(!isCompleted && { color: "gray" })}
					disabled={nextSubmission == null}
				>
					Next submission
				</Button>
				<Button onClick={quickJump.open}>Lookup</Button>
				<Text size="sm">
					{currentSubmissionIndex + 1} / {submissions.length}
				</Text>
			</Group>
			<SubmissionSelector
				open={quickJump.isOpen}
				onClose={quickJump.close}
				onSelectSubmission={navigateToSubmission}
				submissions={submissions}
				progressPromise={progressPromise}
				progressLabel="criteria"
			/>
			<CriterionGradeList
				savedCriteria={savedCriteria}
				criteria={optimisticCriteria}
				pendingByIndex={pendingByIndex}
				disabled={false}
				onAssess={(index, assessment) => assess(index, assessment)}
			/>
			<AssessmentProgressSummary
				marks={marks}
				maxMarks={maxMarks}
				completedCriteria={completedCriteria}
				totalCriteria={totalCriteria}
			/>
		</Stack>
	);
}
