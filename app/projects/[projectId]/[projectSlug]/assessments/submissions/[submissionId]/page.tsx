import Box from "@mui/material/Box";
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";
import { notFound } from "next/navigation";
import { loadSubmissionAssessments } from "#assessments/assessments.ts";
import { loadAssessmentCompletionBySubmission } from "#assessments/loadAssessmentCompletion.ts";
import SubmissionOverviewAssessmentClient from "#assessments/SubmissionOverviewAssessmentClient.tsx";
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

	// Not awaited: only the on-demand submission lookup dialog needs this, so a
	// save-then-navigate never blocks on recomputing project-wide completion
	// (Finding 19). It streams in via Suspense once the dialog resolves it.
	// Started before the page's own Promise.all so it runs alongside that data,
	// not after, shortening the wait if the dialog is opened quickly.
	const progressPromise = loadAssessmentCompletionBySubmission({ projectId });

	const [project, submissions, questionGrid, assessmentsByQuestionId] =
		await Promise.all([
			loadProjectByPublicId(projectId, { required: true }),
			loadSubmissions({ projectId }),
			loadQuestionGrid({ projectId }),
			loadSubmissionAssessments({ submissionId, projectId }),
		]);

	// Ensure the submission belongs to the project and can be assessed.
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

	const gradedQuestions = questions.map((question) => ({
		questionId: question.questionId,
		questionLabel: question.questionLabel,
		rubrics: question.rubrics.map((rubric) =>
			attachAssessment(rubric, assessmentsByQuestionId[question.questionId]),
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
				progressPromise={progressPromise}
				questions={gradedQuestions}
			/>
		</Container>
	);
}
