import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps, ReactElement } from "react";
import { expect, fn, mocked, screen, userEvent, waitFor } from "storybook/test";
import { SaveErrorsProvider } from "#design-system/SaveErrorsProvider.tsx";
import type { AssessedRubric } from "#rubrics/types.ts";
import type { Submission } from "#submissions/types.ts";
import { SaveErrorsDisplay } from "../app-shell/SaveErrorsDisplay.tsx";
import SubmissionAssessmentClient from "./SubmissionAssessmentClient.tsx";
import { assessmentUnreachableMessage } from "./saveAssessmentMessages.ts";

const rubrics: AssessedRubric[] = [
	{
		id: "rubric-correctness",
		type: "boolean",
		label: "Correctness",
		marks: 1,
		falseMarks: 0,
		assessment: null,
	},
];

const submissions: Submission[] = [
	{ id: "submission-1", type: "individual", studentName: "Ada Lovelace" },
];

// saveAssessment is injected as a prop (see saveRubricAssessment.ts) instead
// of imported, so this story never touches the real "use server" action and
// can drive it directly with a plain stub.
function Harness(
	props: ComponentProps<typeof SubmissionAssessmentClient>,
): ReactElement {
	return (
		<SaveErrorsProvider>
			<SubmissionAssessmentClient {...props} />
			<SaveErrorsDisplay />
		</SaveErrorsProvider>
	);
}

const meta = {
	title: "Assessment/SubmissionAssessmentClient",
	component: Harness,
	args: {
		projectId: "project-1",
		projectSlug: "project-slug",
		questionId: "question-1",
		questionLabel: "Question 1",
		rubrics,
		submissions,
		progressPromise: Promise.resolve({}),
		currentSubmissionId: "submission-1",
		saveAssessment: fn(),
	},
} satisfies Meta<typeof Harness>;

export default meta;

type Story = StoryObj<typeof meta>;

function dispatchBeforeUnload(): Event {
	const event = new Event("beforeunload", { cancelable: true });
	window.dispatchEvent(event);
	return event;
}

export const SurfacesUnreachableErrorAndClearsPending: Story = {
	play: async ({ args }) => {
		mocked(args.saveAssessment).mockRejectedValueOnce(
			new Error("network down"),
		);

		await userEvent.click(screen.getByRole("button", { name: "true" }));

		const alert = await screen.findByRole("alert");
		await waitFor(() =>
			expect(alert).toHaveTextContent(assessmentUnreachableMessage),
		);

		// A failed save isn't pending: it must not keep blocking reload.
		expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
	},
};

export const GuardsAgainstReloadWhilePending: Story = {
	play: async ({ args }) => {
		const deferred = Promise.withResolvers<{ success: true }>();
		mocked(args.saveAssessment).mockReturnValueOnce(deferred.promise);

		await userEvent.click(screen.getByRole("button", { name: "true" }));

		await waitFor(() =>
			expect(dispatchBeforeUnload().defaultPrevented).toBe(true),
		);

		deferred.resolve({ success: true });

		await waitFor(() =>
			expect(dispatchBeforeUnload().defaultPrevented).toBe(false),
		);
	},
};
