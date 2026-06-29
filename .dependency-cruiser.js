/** @type {import('dependency-cruiser').IConfiguration} */
// All vertical folder names, current AND target, so the rule survives renames.
const VERTICALS =
	"assessments|questions|import|export|ui|" + // current
	"assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell"; // target
const NON_SHARED = `assessments|questions|import|export|ui|assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell`;

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
				"rubrics/submissions/projects import only design-system + infra (+ intra shared-domain)",
			severity: "error",
			from: { path: "^src/(rubrics|submissions|projects)/" },
			to: { path: `^src/(${NON_SHARED})/` },
		},
		{
			name: "design-system-no-up",
			comment: "design-system imports infra only",
			severity: "error",
			from: {
				path: "^src/(ui|design-system)/(CodeSnippet|MuiNextLink|NumberField|shiki-setup|SaveErrors)",
			},
			to: {
				path: `^src/(rubrics|submissions|projects|${NON_SHARED})/`,
				pathNot: "^src/(ui|design-system)/",
			},
		},
		{
			name: "no-cross-vertical",
			comment:
				"a vertical must not import another vertical (self-excluded via $1)",
			severity: "error",
			from: { path: `^src/(${VERTICALS})/` },
			to: { path: `^src/(${VERTICALS})/`, pathNot: "^src/$1/" },
		},
	],
	options: {
		parser: "tsc",
		tsConfig: { fileName: "tsconfig.json" },
		doNotFollow: { path: "node_modules" },
	},
};
