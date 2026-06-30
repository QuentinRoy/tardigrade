"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
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
import SubmissionQuickJumpDialog from "./SubmissionQuickJumpDialog.tsx";
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
		saveRubric: async (rubric, assessment) => {
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
				rubric: assessment,
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
		return (
			<Typography variant="body1" sx={{ mb: 3 }}>
				No submissions found in database.
			</Typography>
		);
	}

	return (
		<>
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

			<SubmissionQuickJumpDialog
				open={quickJump.isOpen}
				onClose={quickJump.close}
				onSelectSubmission={navigateToSubmission}
				submissions={submissions}
				progressPromise={progressPromise}
				progressLabel="questions"
			/>

			{optimisticQuestions.length === 0 ? (
				<Typography variant="body1" sx={{ mb: 4 }}>
					No questions found in database.
				</Typography>
			) : (
				optimisticQuestions.map((question) => {
					const { marks: questionMarks, maxMarks: questionMaxMarks } =
						summarizeRubrics(question.rubrics);

					return (
						<Box key={question.questionId} sx={{ mb: 4 }}>
							<Box
								sx={{
									mb: 2,
									display: "flex",
									alignItems: "baseline",
									justifyContent: "space-between",
									gap: 1,
								}}
							>
								<Typography component="h2" variant="h5">
									{question.questionLabel}
								</Typography>
								<Typography variant="body2">
									({questionMarks}&nbsp;/&nbsp;{questionMaxMarks})
								</Typography>
							</Box>

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
						</Box>
					);
				})
			)}

			<AssessmentProgressSummary
				marks={summary.marks}
				maxMarks={summary.maxMarks}
				completedRubrics={summary.completedRubrics}
				totalRubrics={summary.totalRubrics}
			/>
		</>
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
		<Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
			<Button
				component={NextLink}
				href={projectAssessmentSubmissionPath({
					projectId,
					projectSlug,
					submissionId: previousSubmissionId ?? currentSubmissionId,
				})}
				prefetch={previousSubmissionId != null}
				variant="outlined"
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
				variant="outlined"
				disabled={nextSubmissionId == null}
			>
				Next submission
			</Button>
			<Button variant="contained" onClick={onOpenLookup}>
				Lookup
			</Button>
			<Typography variant="body2" sx={{ alignSelf: "center", ml: 1 }}>
				{currentSubmissionIndex + 1} / {totalSubmissions} submissions
			</Typography>
		</Box>
	);
}
