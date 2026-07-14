import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps, ReactElement } from "react";
import { expect, fn, mocked, screen, userEvent, waitFor } from "storybook/test";
import { SaveErrorsDisplay } from "#app-shell/SaveErrorsDisplay.tsx";
import type { GradedCriterion } from "#criteria/types.ts";
import { SaveErrorsProvider } from "#design-system/SaveErrorsProvider.tsx";
import type { GradeTarget } from "#grade-targets/types.ts";
import RubricGradingClient from "./RubricGradingClient.tsx";
import { gradeUnreachableMessage } from "./saveCriterionGradeMessages.ts";

const criteria: GradedCriterion[] = [
	{
		id: "criterion-correctness",
		kind: "check",
		label: "Correctness",
		marks: 1,
		falseMarks: 0,
		grade: null,
	},
];

const targets: GradeTarget[] = [
	{ id: "target-1", kind: "individual", studentName: "Ada Lovelace" },
];

// saveCriterionGrade is injected as a prop (see trySaveCriterionGrade.ts) instead
// of imported, so this story never touches the real "use server" action and
// can drive it directly with a plain stub.
function Harness(
	props: ComponentProps<typeof RubricGradingClient>,
): ReactElement {
	return (
		<SaveErrorsProvider>
			<RubricGradingClient {...props} />
			<SaveErrorsDisplay />
		</SaveErrorsProvider>
	);
}

const meta = {
	title: "Grade/RubricGradingClient",
	component: Harness,
	args: {
		gridId: "grid-1",
		gridSlug: "grid-slug",
		rubricId: "rubric-1",
		rubricLabel: "Rubric 1",
		criteria,
		targets,
		completionPromise: Promise.resolve({}),
		currentTargetId: "target-1",
		saveCriterionGrade: fn(),
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
		mocked(args.saveCriterionGrade).mockRejectedValueOnce(
			new Error("network down"),
		);

		await userEvent.click(screen.getByRole("radio", { name: "True" }));

		const alert = await screen.findByRole("alert");
		await waitFor(() =>
			expect(alert).toHaveTextContent(gradeUnreachableMessage),
		);

		// A failed save isn't pending: it must not keep blocking reload.
		expect(dispatchBeforeUnload().defaultPrevented).toBe(false);
	},
};

export const GuardsAgainstReloadWhilePending: Story = {
	play: async ({ args }) => {
		const deferred = Promise.withResolvers<{ success: true }>();
		mocked(args.saveCriterionGrade).mockReturnValueOnce(deferred.promise);

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
