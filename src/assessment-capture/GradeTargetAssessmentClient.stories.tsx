import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps, ReactElement } from "react";
import { expect, fn, mocked, screen, userEvent, waitFor } from "storybook/test";
import { SaveErrorsDisplay } from "#app-shell/SaveErrorsDisplay.tsx";
import type { AssessedCriterion } from "#criteria/types.ts";
import { SaveErrorsProvider } from "#design-system/SaveErrorsProvider.tsx";
import type { GradeTarget } from "#grade-targets/types.ts";
import GradeTargetAssessmentClient from "./GradeTargetAssessmentClient.tsx";
import { assessmentUnreachableMessage } from "./saveAssessmentMessages.ts";

const criteria: AssessedCriterion[] = [
	{
		id: "criterion-correctness",
		kind: "check",
		label: "Correctness",
		marks: 1,
		falseMarks: 0,
		assessment: null,
	},
];

const targets: GradeTarget[] = [
	{ id: "target-1", kind: "individual", studentName: "Ada Lovelace" },
];

// saveAssessment is injected as a prop (see saveCriterionAssessment.ts) instead
// of imported, so this story never touches the real "use server" action and
// can drive it directly with a plain stub.
function Harness(
	props: ComponentProps<typeof GradeTargetAssessmentClient>,
): ReactElement {
	return (
		<SaveErrorsProvider>
			<GradeTargetAssessmentClient {...props} />
			<SaveErrorsDisplay />
		</SaveErrorsProvider>
	);
}

const meta = {
	title: "Assessment/GradeTargetAssessmentClient",
	component: Harness,
	args: {
		projectId: "project-1",
		projectSlug: "project-slug",
		rubricId: "rubric-1",
		rubricLabel: "Rubric 1",
		criteria,
		targets,
		progressPromise: Promise.resolve({}),
		currentTargetId: "target-1",
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

		await userEvent.click(screen.getByRole("radio", { name: "True" }));

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

		await userEvent.click(screen.getByRole("radio", { name: "True" }));

		await waitFor(() =>
			expect(dispatchBeforeUnload().defaultPrevented).toBe(true),
		);

		deferred.resolve({ success: true });

		await waitFor(() =>
			expect(dispatchBeforeUnload().defaultPrevented).toBe(false),
		);
	},
};
