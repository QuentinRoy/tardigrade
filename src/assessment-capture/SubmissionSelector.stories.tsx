import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import type { Submission } from "#submissions/types.ts";
import SubmissionSelector from "./SubmissionSelector.tsx";

const submissions: Submission[] = [
	{
		id: "101",
		type: "team",
		teamName: "Alpha Team",
		displayLabel: "Alpha Team",
		memberNames: ["Alice Martin", "Bob Lee"],
		searchKeys: ["alpha team", "alice martin", "bob lee"],
	},
	{
		id: "102",
		type: "individual",
		studentName: "Charlie Brown",
		displayLabel: "Charlie Brown",
		memberNames: [],
		searchKeys: ["charlie brown"],
	},
];

const meta = {
	title: "Assessment/SubmissionSelector",
	component: SubmissionSelector,
	args: {
		open: true,
		onClose: fn(),
		onSelectSubmission: fn(),
		submissions,
		progressPromise: Promise.resolve({
			101: { completed: 1, total: 2 },
			102: { completed: 2, total: 2 },
		}),
		progressLabel: "criteria",
	},
	argTypes: {
		// A Promise is not a serializable control value; leaving it editable makes
		// Storybook's Controls addon warn about a cycle while inspecting the arg.
		progressPromise: { control: false },
	},
} satisfies Meta<typeof SubmissionSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FiltersAndSelectsViaKeyboard: Story = {
	play: async ({ args }) => {
		const search = screen.getByPlaceholderText(
			"Search by team or student name",
		);
		await waitFor(() => expect(search).toHaveFocus());

		await userEvent.type(search, "alice");

		await waitFor(() => expect(screen.getByText("Alpha Team")).toBeVisible());
		expect(screen.queryByText("Charlie Brown")).toBeNull();

		await userEvent.keyboard("{Enter}");

		expect(args.onSelectSubmission).toHaveBeenCalledWith("101");
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const SelectsViaClick: Story = {
	play: async ({ args }) => {
		const option = await screen.findByText("Charlie Brown");
		await userEvent.click(option);

		expect(args.onSelectSubmission).toHaveBeenCalledWith("102");
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const ClosesOnEscape: Story = {
	play: async ({ args }) => {
		const search = await screen.findByPlaceholderText(
			"Search by team or student name",
		);
		await userEvent.type(search, "{Escape}");

		await waitFor(() => expect(args.onClose).toHaveBeenCalled());
	},
};
