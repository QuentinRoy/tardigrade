// Hand-computed expectations for the grading-workflow smoke test, derived from
// the three fixture payloads in this folder. Keep this file in lockstep with
// those fixtures: if a fixture changes, redo the arithmetic below.
//
// Marks model (from rubrics.yaml):
//   q1:r1 check  -> true = 1, false = 0
//   q2:r2 options  -> excellent = 2, good = 1, poor = 0
//
// Grade targets come from students.csv: each individual student and each group
// becomes one grade target. So three grade targets exist before any grading:
//   john_doe (individual), jane_smith (individual), Group A (bob_johnson).
//
// assessments.csv grades only john_doe and Group A; jane_smith is left
// unassessed on purpose, so completion is a real partial 2 / 3.
//
//   john_doe: q1 = true = 1, q2 = good = 1        -> final_total = 2
//   Group A:  q1 = false = 0, q2 = excellent = 2  -> final_total = 2
//   jane_smith: unassessed                        -> final_total blank
//
// Overview completion semantics (see `src/assessment-completion/assessmentCompletion.ts`):
//   - grade targets: a grade target is complete once every rubric on it is
//     fully assessed. Total = grade target count (3); complete = john_doe,
//     Group A (2).
//   - rubrics: a rubric is complete only once it is fully assessed on every
//     grade target project-wide. Total = rubric count (2); since jane_smith
//     leaves both q1 and q2 incomplete, neither rubric is complete (0).
//   - criteria: counts individual (grade target, rubric) pairs, not
//     deduplicated by rubric. Total = grade targets x rubrics = 3 x 2 = 6;
//     complete = the 4 pairs assessed for john_doe and Group A.

export const PROJECT_NAME = "E2E Smoke Project";

// `final_total` in the grades export, keyed by the export name identifier
// (student id for individuals, group name for groups). `null` means the
// grade target is not fully assessed, so the export leaves the cell blank.
export const EXPECTED_FINAL_TOTAL: Record<string, number | null> = {
	john_doe: 2,
	"Group A": 2,
	jane_smith: null,
};

// Assessment Completion shown on the grid home, as `completed / total`.
export const EXPECTED_COMPLETION = {
	gradeTargets: { completed: 2, total: 3 },
	rubrics: { completed: 0, total: 2 },
	criteria: { completed: 4, total: 6 },
};

// CriterionAnalyticsTable aggregates each criterion across grade targets (see
// `src/results/resultsBuilder.ts`): average = mean marks over *assessed*
// grade targets only (jane_smith's unassessed cells don't count), formatted
// as `<average> / <maxMarks>`; completion = assessed / total grade targets.
//   r1 (q1, check, max 1): assessed marks = john_doe 1, Group A 0
//                            -> average = (1 + 0) / 2 = 0.5
//   r2 (q2, options, max 2): assessed marks = john_doe 1, Group A 2
//                            -> average = (1 + 2) / 2 = 1.5
export const EXPECTED_CRITERION_ANALYTICS = [
	{
		rubricId: "q1",
		criterionId: "r1",
		average: "0.5 / 1",
		completion: { completed: 2, total: 3 },
	},
	{
		rubricId: "q2",
		criterionId: "r2",
		average: "1.5 / 2",
		completion: { completed: 2, total: 3 },
	},
] as const;

// GradeMatrix shows one row per grade target with one cell per criterion
// ("<marks> / <maxMarks>", or empty if the criterion is unassessed), then a
// per-row total and criterion-completion count. Grade target labels come
// from `getGradeTargetLabel`: individuals as "<last_name> <first_name>", groups
// as the group name.
export const EXPECTED_GRADE_MATRIX = [
	{
		label: "Doe John",
		cells: { r1: "1 / 1", r2: "1 / 2" },
		total: "2 / 3",
		completion: { completed: 2, total: 2 },
	},
	{
		label: "Smith Jane",
		cells: { r1: "", r2: "" },
		total: "0 / 0",
		completion: { completed: 0, total: 2 },
	},
	{
		label: "Group A",
		cells: { r1: "0 / 1", r2: "2 / 2" },
		total: "2 / 3",
		completion: { completed: 2, total: 2 },
	},
] as const;
