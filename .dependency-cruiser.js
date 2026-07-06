/** @type {import('dependency-cruiser').IConfiguration} */
const VERTICALS =
	"export|assessment-capture|assessment-completion|rubric-analytics|question-management|imports|app-shell";
const NON_SHARED = VERTICALS;
const SHARED_DOMAIN =
	"rubrics|submissions|projects|assessment-persistence|questions";
// Tests and stories legitimately exercise more than one vertical (e.g. an
// import/export round-trip integration test, or a story rendering a
// component plus a sibling vertical's display surface); only production
// code must respect the boundary.
const TEST_FILE = "\\.(integration\\.)?(test|stories)\\.tsx?$";

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
				"rubrics/submissions/projects/assessment-persistence/questions import only design-system + infra (+ intra shared-domain)",
			severity: "error",
			from: { path: `^src/(${SHARED_DOMAIN})/`, pathNot: TEST_FILE },
			to: { path: `^src/(${NON_SHARED})/` },
		},
		{
			name: "design-system-no-up",
			comment: "design-system imports infra only",
			severity: "error",
			from: { path: "^src/design-system/", pathNot: TEST_FILE },
			to: {
				path: `^src/(${SHARED_DOMAIN}|${NON_SHARED})/`,
				pathNot: "^src/design-system/",
			},
		},
		{
			name: "no-cross-vertical",
			comment:
				"a vertical must not import another vertical (self-excluded via $1); tests are exempt (see TEST_FILE)",
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
