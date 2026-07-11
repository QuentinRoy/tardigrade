import "server-only";

import pino from "pino";

// Closed scope vocabulary: the feature folders (ADR-0006/0002) plus the `db`
// infrastructure module. Keeping this a union rather than a free string means
// scope names cannot drift or be typo'd across call sites.
// See docs/adr/0009-server-side-logging-with-pino.md
type LogScope =
	| "db"
	| "assessments"
	| "export"
	| "import"
	| "projects"
	| "rubrics"
	| "criteria"
	| "grade-targets";

const rootLogger = pino();

// Returns a child logger that tags every line with its originating scope, so
// logs can be filtered by subsystem. Scope and logging rules: see the ADR above.
export function createLogger(scope: LogScope) {
	return rootLogger.child({ scope });
}
