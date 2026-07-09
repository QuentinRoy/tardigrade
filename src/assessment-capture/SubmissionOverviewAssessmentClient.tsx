"use client";

import { Button, Group, Stack, Text, Title } from "@mantine/core";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useMemo } from "react";
import type { AssessedCriterion } from "#criteria/types.ts";
import {
	type SaveError,
	useSaveErrors,
} from "#design-system/SaveErrorsProvider.tsx";
import { projectAssessmentSubmissionPath } from "#projects/projectPaths.ts";
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

type QuestionAssessmentSection = {
	questionId: string;
	questionLabel: string;
	criteria: AssessedCriterion[];
};

type OptimisticQuestionSection = {
	questionId: string;
	questionLabel: string;
	criteria: AssessedCriterion[];
	flatIndices: Array<number | undefined>;
};

type SubmissionOverviewAssessmentClientProps = {
	projectId: string;
	projectSlug: string;
	questions: QuestionAssessmentSection[];
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

export default function SubmissionOverviewAssessmentClient({
	projectId,
	projectSlug,
	questions: initialQuestions,
	submissions,
	progressPromise,
	currentSubmissionId,
	saveAssessment,
}: SubmissionOverviewAssessmentClientProps): ReactElement {
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

	const { initialCriteria, criterionInfoByCriterionId } = useMemo(() => {
		const criteria: AssessedCriterion[] = [];
		const infoMap = new Map<
			string,
			{ questionId: string; questionLabel: string }
		>();

		for (const question of initialQuestions) {
			for (const criterion of question.criteria) {
				criteria.push(criterion);
				infoMap.set(criterion.id, {
					questionId: question.questionId,
					questionLabel: question.questionLabel,
				});
			}
		}

		return { initialCriteria: criteria, criterionInfoByCriterionId: infoMap };
	}, [initialQuestions]);

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
		saveAssessment: async (criterion, assessment) => {
			const info = criterionInfoByCriterionId.get(criterion.id);
			const baseErrorContext = {
				projectId,
				projectSlug,
				submissionId: currentSubmissionId,
				submissionLabel: currentSubmissionLabel,
			};

			if (info == null) {
				return {
					success: false,
					error: {
						...baseErrorContext,
						questionId: "unknown-question",
						questionLabel: "Unknown question",
						message: `Unknown criterion mapping for ${criterion.id}`,
					},
				};
			}

			return saveCriterionAssessment({
				saveAssessment,
				submissionId: currentSubmissionId,
				questionId: info.questionId,
				assessment,
				errorContext: {
					...baseErrorContext,
					questionId: info.questionId,
					questionLabel: info.questionLabel,
				},
			});
		},
		onError: addError,
	});

	const optimisticQuestions = useMemo<OptimisticQuestionSection[]>(() => {
		const criterionToFlatIndex = new Map<string, number>();

		for (let i = 0; i < optimisticCriteria.length; i++) {
			const optimisticCriterion = optimisticCriteria[i];
			if (optimisticCriterion == null) {
				continue;
			}
			criterionToFlatIndex.set(optimisticCriterion.id, i);
		}

		return initialQuestions.map((question) => ({
			questionId: question.questionId,
			questionLabel: question.questionLabel,
			criteria: question.criteria.map((criterion) => {
				const flatIndex = criterionToFlatIndex.get(criterion.id);
				return flatIndex != null
					? (optimisticCriteria[flatIndex] ?? criterion)
					: criterion;
			}),
			flatIndices: question.criteria.map((criterion) =>
				criterionToFlatIndex.get(criterion.id),
			),
		}));
	}, [initialQuestions, optimisticCriteria]);

	const summary = summarizeCriteria(optimisticCriteria);

	const navigateToSubmission = (submissionId: string) => {
		router.push(
			projectAssessmentSubmissionPath({ projectId, projectSlug, submissionId }),
		);
	};

	if (currentSubmission == null) {
		return <Text>No submissions found in database.</Text>;
	}

	return (
		<Stack gap="xl">
			<SubmissionNavigation
				projectId={projectId}
				projectSlug={projectSlug}
				currentSubmissionId={currentSubmissionId}
				currentSubmissionIndex={currentSubmissionIndex}
				totalSubmissions={submissions.length}
				previousSubmissionId={previousSubmission?.id}
				nextSubmissionId={nextSubmission?.id}
				onOpenLookup={quickJump.open}
			/>

			<SubmissionSelector
				open={quickJump.isOpen}
				onClose={quickJump.close}
				onSelectSubmission={navigateToSubmission}
				submissions={submissions}
				progressPromise={progressPromise}
				progressLabel="questions"
			/>

			{optimisticQuestions.length === 0 ? (
				<Text>No questions found in database.</Text>
			) : (
				<Stack gap="xl">
					{optimisticQuestions.map((question) => {
						const { marks: questionMarks, maxMarks: questionMaxMarks } =
							summarizeCriteria(question.criteria);

						return (
							<Stack key={question.questionId} gap="md">
								<Group justify="space-between" align="baseline" gap="xs">
									<Title m="0" order={2}>
										{question.questionLabel}
									</Title>
									<Text size="sm">
										({questionMarks}&nbsp;/&nbsp;{questionMaxMarks})
									</Text>
								</Group>

								{question.criteria.map((criterion, localIndex) => {
									const flatIndex = question.flatIndices[localIndex];
									const savedCriterion =
										flatIndex != null
											? (savedCriteria[flatIndex] ?? criterion)
											: criterion;
									return (
										<CriterionGradeList
											key={criterion.id}
											savedCriteria={[savedCriterion]}
											criteria={[criterion]}
											pendingByIndex={{
												0:
													flatIndex != null
														? (pendingByIndex[flatIndex] ?? 0)
														: 0,
											}}
											disabled={false}
											onAssess={(_, assessment) => {
												if (flatIndex != null) {
													assess(flatIndex, assessment);
												}
											}}
										/>
									);
								})}
							</Stack>
						);
					})}
				</Stack>
			)}

			<AssessmentProgressSummary
				marks={summary.marks}
				maxMarks={summary.maxMarks}
				completedCriteria={summary.completedCriteria}
				totalCriteria={summary.totalCriteria}
			/>
		</Stack>
	);
}

function SubmissionNavigation({
	projectId,
	projectSlug,
	currentSubmissionId,
	currentSubmissionIndex,
	totalSubmissions,
	previousSubmissionId,
	nextSubmissionId,
	onOpenLookup,
}: {
	projectId: string;
	projectSlug: string;
	currentSubmissionId: string;
	currentSubmissionIndex: number;
	totalSubmissions: number;
	previousSubmissionId?: string | undefined;
	nextSubmissionId?: string | undefined;
	onOpenLookup: () => void;
}): ReactElement {
	return (
		<Group gap="xs" wrap="wrap">
			<Button
				component={NextLink}
				href={projectAssessmentSubmissionPath({
					projectId,
					projectSlug,
					submissionId: previousSubmissionId ?? currentSubmissionId,
				})}
				prefetch={previousSubmissionId != null}
				variant="outline"
				disabled={previousSubmissionId == null}
			>
				Previous submission
			</Button>
			<Button
				component={NextLink}
				href={projectAssessmentSubmissionPath({
					projectId,
					projectSlug,
					submissionId: nextSubmissionId ?? currentSubmissionId,
				})}
				prefetch={nextSubmissionId != null}
				variant="outline"
				disabled={nextSubmissionId == null}
			>
				Next submission
			</Button>
			<Button onClick={onOpenLookup}>Lookup</Button>
			<Text size="sm">
				{currentSubmissionIndex + 1} / {totalSubmissions} submissions
			</Text>
		</Group>
	);
}
