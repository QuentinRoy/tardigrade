"use client";

import { Button, Group, Stack, Text, Title } from "@mantine/core";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";
import { useMemo } from "react";
import {
	type SaveError,
	useSaveErrors,
} from "#design-system/SaveErrorsProvider.tsx";
import { projectAssessmentSubmissionPath } from "#projects/projectPaths.ts";
import type { AssessedRubric } from "#rubrics/types.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import type { Submission } from "#submissions/types.ts";
import AssessmentProgressSummary from "./AssessmentProgressSummary.tsx";
import { summarizeRubrics } from "./assessmentSummary.ts";
import RubricGradeList from "./RubricGradeList.tsx";
import SubmissionSelector from "./SubmissionSelector.tsx";
import type { SaveAssessment } from "./saveRubricAssessment.ts";
import { saveRubricAssessment } from "./saveRubricAssessment.ts";
import { getSubmissionNavigation } from "./submissionNavigation.ts";
import { useAssessmentSession } from "./useAssessmentSession.ts";
import { useSubmissionQuickJump } from "./useSubmissionQuickJump.ts";

type QuestionAssessmentSection = {
	questionId: string;
	questionLabel: string;
	rubrics: AssessedRubric[];
};

type OptimisticQuestionSection = {
	questionId: string;
	questionLabel: string;
	rubrics: AssessedRubric[];
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

	const { initialRubrics, rubricInfoByRubricId } = useMemo(() => {
		const rubrics: AssessedRubric[] = [];
		const infoMap = new Map<
			string,
			{ questionId: string; questionLabel: string }
		>();

		for (const question of initialQuestions) {
			for (const rubric of question.rubrics) {
				rubrics.push(rubric);
				infoMap.set(rubric.id, {
					questionId: question.questionId,
					questionLabel: question.questionLabel,
				});
			}
		}

		return { initialRubrics: rubrics, rubricInfoByRubricId: infoMap };
	}, [initialQuestions]);

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
		saveAssessment: async (rubric, assessment) => {
			const info = rubricInfoByRubricId.get(rubric.id);
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
						message: `Unknown rubric mapping for ${rubric.id}`,
					},
				};
			}

			return saveRubricAssessment({
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
		const rubricToFlatIndex = new Map<string, number>();

		for (let i = 0; i < optimisticRubrics.length; i++) {
			const optimisticRubric = optimisticRubrics[i];
			if (optimisticRubric == null) {
				continue;
			}
			rubricToFlatIndex.set(optimisticRubric.id, i);
		}

		return initialQuestions.map((question) => ({
			questionId: question.questionId,
			questionLabel: question.questionLabel,
			rubrics: question.rubrics.map((rubric) => {
				const flatIndex = rubricToFlatIndex.get(rubric.id);
				return flatIndex != null
					? (optimisticRubrics[flatIndex] ?? rubric)
					: rubric;
			}),
			flatIndices: question.rubrics.map((rubric) =>
				rubricToFlatIndex.get(rubric.id),
			),
		}));
	}, [initialQuestions, optimisticRubrics]);

	const summary = summarizeRubrics(optimisticRubrics);

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
							summarizeRubrics(question.rubrics);

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

								{question.rubrics.map((rubric, localIndex) => {
									const flatIndex = question.flatIndices[localIndex];
									const savedRubric =
										flatIndex != null
											? (savedRubrics[flatIndex] ?? rubric)
											: rubric;
									return (
										<RubricGradeList
											key={rubric.id}
											savedRubrics={[savedRubric]}
											rubrics={[rubric]}
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
				completedRubrics={summary.completedRubrics}
				totalRubrics={summary.totalRubrics}
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
