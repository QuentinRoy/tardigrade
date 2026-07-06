// Hand-computed expectations for the grading-workflow smoke test, derived from
// the three fixture payloads in this folder. Keep this file in lockstep with
// those fixtures: if a fixture changes, redo the arithmetic below.
//
// Marks model (from questions.yaml):
//   q1:r1 boolean  -> true = 1, false = 0
//   q2:r2 ordinal  -> excellent = 2, good = 1, poor = 0
//
// Submissions come from students.csv: each individual student and each team
// becomes one submission. So three submissions exist before any grading:
//   john_doe (individual), jane_smith (individual), Team A (bob_johnson).
//
// assessments.csv grades only john_doe and Team A; jane_smith is left
// unassessed on purpose, so completion is a real partial 2 / 3.
//
//   john_doe: q1 = true = 1, q2 = good = 1        -> grand_total_marks = 2
//   Team A:   q1 = false = 0, q2 = excellent = 2  -> grand_total_marks = 2
//   jane_smith: unassessed                        -> grand_total_marks blank
//
// Dashboard completion semantics (see `src/assessments/assessmentCompletion.ts`):
//   - submissions: a submission is complete once every question on it is fully
//     assessed. Total = submission count (3); complete = john_doe, Team A (2).
//   - questions: a question is complete only once it is fully assessed on every
//     submission project-wide. Total = question count (2); since jane_smith
//     leaves both q1 and q2 incomplete, neither question is complete (0).
//   - rubrics: counts individual (submission, rubric) pairs, not deduplicated
//     by question. Total = submissions x rubrics = 3 x 2 = 6; complete = the 4
//     pairs assessed for john_doe and Team A.

export const PROJECT_NAME = "E2E Smoke Project";

// `grand_total_marks` in the submissions export, keyed by the export submitter
// identifier (student id for individuals, team name for teams). `null` means the
// submission is not fully assessed, so the export leaves the cell blank.
export const EXPECTED_GRAND_TOTAL_MARKS: Record<string, number | null> = {
	john_doe: 2,
	"Team A": 2,
	jane_smith: null,
};

// Assessment Completion shown on the dashboard, as `completed / total`.
export const EXPECTED_COMPLETION = {
	submissions: { completed: 2, total: 3 },
	questions: { completed: 0, total: 2 },
	rubrics: { completed: 4, total: 6 },
};

// RubricAnalyticsTable aggregates each rubric across submissions (see
// `src/rubric-analytics/rubricOverviewBuilder.ts`): average = mean marks over
// *assessed* submissions only (jane_smith's unassessed cells don't count),
// formatted as `<average> / <maxMarks>`; completion = assessed / total
// submissions.
//   r1 (q1, boolean, max 1): assessed marks = john_doe 1, Team A 0
//                            -> average = (1 + 0) / 2 = 0.5
//   r2 (q2, ordinal, max 2): assessed marks = john_doe 1, Team A 2
//                            -> average = (1 + 2) / 2 = 1.5
export const EXPECTED_RUBRIC_ANALYTICS = [
	{
		questionId: "q1",
		rubricId: "r1",
		average: "0.5 / 1",
		completion: { completed: 2, total: 3 },
	},
	{
		questionId: "q2",
		rubricId: "r2",
		average: "1.5 / 2",
		completion: { completed: 2, total: 3 },
	},
] as const;

// SubmissionMatrix shows one row per submission with one cell per rubric
// ("<marks> / <maxMarks>", or empty if the criterion is unassessed), then a
// per-submission average and rubric-completion count. Submission labels come
// from `getSubmissionLabel`: individuals as "<last_name> <first_name>", teams
// as the team name.
export const EXPECTED_SUBMISSION_MATRIX = [
	{
		submissionLabel: "Doe John",
		cells: { r1: "1 / 1", r2: "1 / 2" },
		average: "2 / 3",
		completion: { completed: 2, total: 2 },
	},
	{
		submissionLabel: "Smith Jane",
		cells: { r1: "", r2: "" },
		average: "0 / 0",
		completion: { completed: 0, total: 2 },
	},
	{
		submissionLabel: "Team A",
		cells: { r1: "0 / 1", r2: "2 / 2" },
		average: "2 / 3",
		completion: { completed: 2, total: 2 },
	},
] as const;
