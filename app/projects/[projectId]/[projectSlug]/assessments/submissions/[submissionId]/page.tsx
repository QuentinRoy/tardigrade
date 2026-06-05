import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { loadAssessment } from "#assessments/assessments.ts";
import SubmissionOverviewAssessmentClient from "#assessments/SubmissionOverviewAssessmentClient.tsx";
import { loadSubmissionOverviewProgress } from "#assessments/submissionProgress.ts";
import { projectAssessmentsPath } from "#projects/projectPaths.ts";
import { loadProjectByPublicId } from "#projects/projects.ts";
import { loadQuestionGrid } from "#questions/questions.ts";
import { attachAssessment } from "#rubrics/rubric.ts";
import { getSubmissionLabel } from "#submissions/getSubmissionLabel.ts";
import { loadSubmissions } from "#submissions/submissions.ts";
import MuiNextLink from "#ui/MuiNextLink.tsx";

type PageParams = {
	projectId: string;
	projectSlug: string;
	submissionId: string;
};

type SubmissionPageProps = { params: Promise<PageParams> };

export default function ProjectSubmissionPage({ params }: SubmissionPageProps) {
	return <ProjectSubmissionPageContent params={params} />;
}

async function ProjectSubmissionPageContent({ params }: SubmissionPageProps) {
	const { submissionId, projectId } = await params;

	const project = await loadProjectByPublicId(projectId, { required: true });

	const [submissions, questionGrid, progressBySubmissionId] = await Promise.all(
		[
			loadSubmissions(project.id),
			loadQuestionGrid(project.id),
			loadSubmissionOverviewProgress(project.id),
		],
	);
	const currentSubmission = submissions.find((s) => s.id === submissionId);

	if (currentSubmission == null) {
		notFound();
	}

	const questions = Object.entries(questionGrid).map(
		([questionId, question]) => ({
			questionId,
			questionLabel: question.label ?? questionId,
			rubrics: question.rubrics,
		}),
	);

	const assessments = await Promise.all(
		questions.map((question) =>
			loadAssessment(submissionId, question.questionId),
		),
	);

	const gradedQuestions = questions.map((question, index) => ({
		questionId: question.questionId,
		questionLabel: question.questionLabel,
		rubrics: question.rubrics.map((rubric) =>
			attachAssessment(rubric, assessments[index]),
		),
	}));

	return (
		<Container maxWidth="md" sx={{ py: 5 }}>
			<Box component="header" sx={{ pb: 2 }}>
				<Breadcrumbs aria-label="breadcrumb">
					<MuiNextLink
						color="inherit"
						href={projectAssessmentsPath(project.id, project.slug)}
					>
						Assessments
					</MuiNextLink>
					<Typography color="textPrimary">
						{getSubmissionLabel(currentSubmission)}
					</Typography>
				</Breadcrumbs>
				<Typography component="h1" variant="h4" gutterBottom sx={{ mt: 1 }}>
					{getSubmissionLabel(currentSubmission)}
				</Typography>
			</Box>

			<SubmissionOverviewAssessmentClient
				projectId={project.id}
				projectSlug={project.slug}
				currentSubmissionId={submissionId}
				submissions={submissions}
				progressBySubmissionId={progressBySubmissionId}
				questions={gradedQuestions}
			/>
		</Container>
	);
}
