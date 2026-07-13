import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import type { GradeTarget } from "#grade-targets/types.ts";
import GradeTargetSelector from "./GradeTargetSelector.tsx";

const targets: GradeTarget[] = [
	{
		id: "101",
		kind: "group",
		groupName: "Alpha Group",
		displayLabel: "Alpha Group",
		memberNames: ["Alice Martin", "Bob Lee"],
		searchKeys: ["alpha group", "alice martin", "bob lee"],
	},
	{
		id: "102",
		kind: "individual",
		studentName: "Charlie Brown",
		displayLabel: "Charlie Brown",
		memberNames: [],
		searchKeys: ["charlie brown"],
	},
];

const meta = {
	title: "Grade/GradeTargetSelector",
	component: GradeTargetSelector,
	args: {
		open: true,
		onClose: fn(),
		onSelectTarget: fn(),
		targets,
		completionPromise: Promise.resolve({
			101: { completed: 1, total: 2 },
			102: { completed: 2, total: 2 },
		}),
		progressLabel: "criteria",
	},
	argTypes: {
		// A Promise is not a serializable control value; leaving it editable makes
		// Storybook's Controls addon warn about a cycle while inspecting the arg.
		completionPromise: { control: false },
	},
} satisfies Meta<typeof GradeTargetSelector>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FiltersAndSelectsViaKeyboard: Story = {
	play: async ({ args }) => {
		const search = screen.getByPlaceholderText(
			"Search by group or student name",
		);
		await waitFor(() => expect(search).toHaveFocus());

		await userEvent.type(search, "alice");

		await waitFor(() => expect(screen.getByText("Alpha Group")).toBeVisible());
		expect(screen.queryByText("Charlie Brown")).toBeNull();

		await userEvent.keyboard("{Enter}");

		expect(args.onSelectTarget).toHaveBeenCalledWith("101");
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const SelectsViaClick: Story = {
	play: async ({ args }) => {
		const option = await screen.findByText("Charlie Brown");
		await userEvent.click(option);

		expect(args.onSelectTarget).toHaveBeenCalledWith("102");
		expect(args.onClose).toHaveBeenCalled();
	},
};

export const ClosesOnEscape: Story = {
	play: async ({ args }) => {
		const search = await screen.findByPlaceholderText(
			"Search by group or student name",
		);
		await userEvent.type(search, "{Escape}");

		await waitFor(() => expect(args.onClose).toHaveBeenCalled());
	},
};
