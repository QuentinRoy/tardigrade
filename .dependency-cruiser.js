/** @type {import('dependency-cruiser').IConfiguration} */
// All vertical folder names, current AND target, so the rule survives renames.
const VERTICALS =
	"questions|export|" + // current
	"assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell"; // target
const NON_SHARED = `questions|export|assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell`;
const SHARED_DOMAIN = "rubrics|submissions|projects|assessment-persistence";
// Test and story files are dev-only surface: they never ship, so an import
// across a layer boundary there isn't a real runtime dependency (e.g. a
// story rendering a component plus a sibling vertical's test-only display
// stub). Excluded from every boundary rule below via `from.pathNot`.
const TEST_FILE = "\\.(test|stories)\\.[jt]sx?$";

export default {
	forbidden: [
		{
			name: "no-circular",
			severity: "error",
			from: {},
			to: { circular: true },
		},
		{
			name: "shared-domain-no-up",
			comment:
				"rubrics/submissions/projects/assessment-persistence import only design-system + infra (+ intra shared-domain)",
			severity: "error",
			from: { path: `^src/(${SHARED_DOMAIN})/`, pathNot: TEST_FILE },
			to: { path: `^src/(${NON_SHARED})/` },
		},
		{
			name: "design-system-no-up",
			comment: "design-system imports infra only",
			severity: "error",
			from: {
				path: "^src/design-system/(CodeSnippet|MuiNextLink|NumberField|shiki-setup|SaveErrors)",
				pathNot: TEST_FILE,
			},
			to: {
				path: `^src/(${SHARED_DOMAIN}|${NON_SHARED})/`,
				pathNot: "^src/design-system/",
			},
		},
		{
			name: "no-cross-vertical",
			comment:
				"a vertical must not import another vertical (self-excluded via $1)",
			severity: "error",
			from: { path: `^src/(${VERTICALS})/`, pathNot: TEST_FILE },
			to: { path: `^src/(${VERTICALS})/`, pathNot: "^src/$1/" },
		},
	],
	options: {
		parser: "tsc",
		tsConfig: { fileName: "tsconfig.json" },
		doNotFollow: { path: "node_modules" },
	},
};
