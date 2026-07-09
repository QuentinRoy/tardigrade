import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import DeleteRubricDialog from "./DeleteRubricDialog.tsx";

const meta = {
	title: "Rubrics/DeleteRubricDialog",
	component: DeleteRubricDialog,
	tags: ["autodocs"],
	args: {
		open: true,
		definition: {
			id: "q1",
			position: 0,
			assessmentCount: 5,
			rubric: { label: "Correctness", criteria: [] },
		},
		action: fn(),
		actionState: { status: "idle" },
		onClose: fn(),
	},
} satisfies Meta<typeof DeleteRubricDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmationGate: Story = {
	play: async () => {
		const deleteButton = screen.getByRole("button", { name: /delete rubric/i });

		await expect(deleteButton).toBeDisabled();

		await userEvent.type(
			screen.getByLabelText("Confirmation"),
			"DELETE q1 (5 assessments)",
		);

		await waitFor(() => {
			expect(deleteButton).toBeEnabled();
		});
	},
};
