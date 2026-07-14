import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import type { ComponentProps, ComponentType } from "react";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import type { GradeTarget } from "#grade-targets/types.ts";
import GradeTargetSelector from "./GradeTargetSelector.tsx";

type CompletionByTargetId = Record<
	string,
	{ completed: number; total: number }
>;

type StoryArgs = Omit<
	ComponentProps<typeof GradeTargetSelector>,
	"completionPromise"
>;

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
	// completionPromise is a required prop, but it's supplied through the
	// loader below rather than through args, so TS can't verify it's actually
	// there — Storybook's Meta/StoryObj types tie a component's required props
	// directly to args and have no notion of a loader filling the gap.
	// biome-ignore lint/plugin/no-type-assertion: narrows the component type to StoryArgs, which omits completionPromise since it comes from the loader, not args.
	component: GradeTargetSelector as ComponentType<StoryArgs>,
	args: {
		open: true,
		onClose: fn(),
		onSelectTarget: fn(),
		targets,
		progressLabel: "criteria",
	},
	// completionPromise isn't a serializable arg: Storybook inspects and
	// serializes every arg, and a Promise triggers a "cycle" warning. A loader
	// keeps it out of the args channel entirely and merges it in at render time.
	loaders: [
		async () => ({
			completionPromise: Promise.resolve<CompletionByTargetId>({
				101: { completed: 1, total: 2 },
				102: { completed: 2, total: 2 },
			}),
		}),
	],
	render: (args, { loaded }) => {
		const completionPromise: Promise<CompletionByTargetId> =
			loaded["completionPromise"];
		return (
			<GradeTargetSelector {...args} completionPromise={completionPromise} />
		);
	},
} satisfies Meta<StoryArgs>;

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
