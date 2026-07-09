import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import QuestionsManagementClient from "./QuestionsManagementClient.tsx";

const meta = {
	title: "Questions/QuestionsManagementClient",
	component: QuestionsManagementClient,
	args: {
		questions: [
			{
				id: "q1",
				position: 0,
				assessmentCount: 0,
				question: { label: "Correctness", criteria: [] },
			},
		],
		saveAction: fn(async () => ({
			status: "success" as const,
			message: "Saved.",
		})),
		deleteAction: fn(),
		reorderAction: fn(async () => {}),
	},
} satisfies Meta<typeof QuestionsManagementClient>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Regression: the effect driving post-save navigation depended on
// saveState.status, which stays the string "success" across two
// consecutive successful saves. The effect's dependency array sees no
// change between them, so it does not re-run on the second save and the
// form is left open instead of returning to view mode.
export const SecondConsecutiveSaveSettles: Story = {
	play: async () => {
		await userEvent.click(screen.getByRole("button", { name: "Edit" }));
		await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
		});

		await userEvent.click(screen.getByRole("button", { name: "Edit" }));
		await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
		await waitFor(() => {
			expect(screen.queryByRole("button", { name: "Save changes" })).toBeNull();
		});
	},
};
