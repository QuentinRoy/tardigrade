import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import SelectedQuestionPane from "./SelectedQuestionPane.tsx";

const meta = {
	title: "Questions/SelectedQuestionPane",
	component: SelectedQuestionPane,
	args: {
		definition: {
			id: "q1",
			position: 0,
			assessmentCount: 5,
			question: { label: "Correctness", rubrics: [] },
		},
		deleteAction: fn(async () => ({
			status: "success" as const,
			message: "Question deleted.",
		})),
		onEdit: fn(),
		onDeleteSuccess: fn(),
	},
} satisfies Meta<typeof SelectedQuestionPane>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Regression for #172: a successful delete must settle in one stable pass —
// the dialog closes and the success callback fires exactly once, instead of
// re-firing on every render (which drove the validation/refresh loop).
export const DeleteSettlesOnce: Story = {
	play: async ({ args }) => {
		await userEvent.click(screen.getByRole("button", { name: "Delete" }));

		await userEvent.type(
			screen.getByLabelText("Confirmation"),
			"DELETE q1 (5 assessments)",
		);

		const confirmButton = screen.getByRole("button", {
			name: /delete question/i,
		});
		await waitFor(() => expect(confirmButton).toBeEnabled());
		await userEvent.click(confirmButton);

		await waitFor(() => {
			expect(args.onDeleteSuccess).toHaveBeenCalledTimes(1);
		});

		// Dialog closed: its confirmation field is gone from the document.
		await waitFor(() => {
			expect(screen.queryByLabelText("Confirmation")).toBeNull();
		});

		// Stays settled — no re-firing once the action state remains "success".
		expect(args.onDeleteSuccess).toHaveBeenCalledTimes(1);
	},
};
