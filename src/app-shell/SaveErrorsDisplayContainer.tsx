"use client";

import { SaveErrorsDisplay } from "#design-system/SaveErrorsDisplay.tsx";
import { projectAssessmentSubmissionQuestionPath } from "#projects/projectPaths.ts";

// SaveErrorsDisplay's buildErrorHref prop is a function, which a Server
// Component (app/layout.tsx) cannot pass to a Client Component. This client
// wrapper builds it locally so layout.tsx only ever renders an element.
export default function SaveErrorsDisplayContainer() {
	return (
		<SaveErrorsDisplay
			buildErrorHref={(error) => projectAssessmentSubmissionQuestionPath(error)}
		/>
	);
}
