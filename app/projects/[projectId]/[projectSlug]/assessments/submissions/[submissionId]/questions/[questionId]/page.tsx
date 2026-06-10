import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { cacheTag } from "next/cache";
import { notFound } from "next/navigation";
import { loadQuestionAssessment } from "#assessments/assessments.ts";
import SubmissionAssessmentClient from "#assessments/SubmissionAssessmentClient.tsx";
import { loadSubmissionQuestionProgress } from "#assessments/submissionProgress.ts";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadQuestion } from "#questions/questions.ts";
import { attachAssessment } from "#rubrics/rubric.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import CodeSnippet from "#ui/CodeSnippet.tsx";
import MuiNextLink from "#ui/MuiNextLink.tsx";

type PageParams = {
	projectId: string;
	projectSlug: string;
	submissionId: string;
	questionId: string;
};

type QuestionSubmissionPageProps = { params: Promise<PageParams> };

export default function ProjectQuestionSubmissionPage({
	params,
}: QuestionSubmissionPageProps) {
	return <ProjectQuestionSubmissionPageContent params={params} />;
}

async function ProjectQuestionSubmissionPageContent({
	params,
}: QuestionSubmissionPageProps) {
	const { projectId, submissionId, questionId } = await params;

	return (
		<Container maxWidth="md" sx={{ py: 5 }}>
			<QuestionHeaderSection projectId={projectId} questionId={questionId} />
			<SubmissionRubricSection
				questionId={questionId}
				submissionId={submissionId}
				projectId={projectId}
			/>
		</Container>
	);
}

async function QuestionHeaderSection({
	projectId,
	questionId,
}: {
	projectId: string;
	questionId: string;
}) {
	"use cache";
	cacheTag("questions", `questions:${questionId}`);

	const project = await loadProjectByPublicId(projectId, { required: true });

	const question = await loadQuestion({ questionId, projectId: project.id });

	if (question == null) {
		notFound();
	}

	return (
		<>
			<Box component="header" sx={{ pb: 2 }}>
				<Breadcrumbs aria-label="breadcrumb">
					<MuiNextLink
						color="inherit"
						href={projectAssessmentsPath(project.id, project.slug)}
					>
						Assessments
					</MuiNextLink>
					<Typography color="textPrimary">
						{question.label ?? questionId}
					</Typography>
				</Breadcrumbs>
			</Box>

			<Box component="section">
				<Typography component="h1" variant="h4" gutterBottom>
					{question.label ?? questionId}
				</Typography>
			</Box>
		</>
	);
}

async function SubmissionRubricSection({
	questionId,
	submissionId,
	projectId,
}: {
	questionId: string;
	submissionId: string;
	projectId: string;
}) {
	"use cache";
	cacheTag(`assessments:${submissionId}:${questionId}`);
	cacheTag(`assessments:question:${questionId}`);
	cacheTag(`questions:${questionId}`);
	cacheTag("submissions");

	const project = await loadProjectByPublicId(projectId, { required: true });

	const [question, submissions, assessments, progressBySubmissionId] =
		await Promise.all([
			loadQuestion({ questionId, projectId: project.id }),
			loadSubmissions({ projectId: project.id }),
			loadQuestionAssessment({
				submissionId,
				questionId,
				projectId: project.id,
			}),
			loadSubmissionQuestionProgress({ questionId, projectId: project.id }),
		]);
	const hasSubmission = submissions.some(
		(submission) => submission.id === submissionId,
	);

	if (question == null || !hasSubmission) {
		notFound();
	}

	const rubricsWithAssessments = question.rubrics.map((rubric) =>
		attachAssessment(rubric, assessments),
	);

	return (
		<SubmissionAssessmentClient
			key={`${questionId}-${submissionId}`}
			projectId={project.id}
			projectSlug={project.slug}
			questionId={questionId}
			questionLabel={question.label}
			rubrics={rubricsWithAssessments}
			submissions={submissions}
			progressBySubmissionId={progressBySubmissionId}
			currentSubmissionId={submissionId}
		/>
	);
}
