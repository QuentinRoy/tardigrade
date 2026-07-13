import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import RubricTable from "./RubricTable.tsx";
import type { RubricDefinition } from "./types.ts";

const sampleRubrics: RubricDefinition[] = [
	{
		id: "q1",
		position: 0,
		gradedTargetCount: 12,
		rubric: { label: "Correctness", criteria: [] },
	},
	{
		id: "q2",
		position: 1,
		gradedTargetCount: 8,
		rubric: { label: "Code Quality", criteria: [] },
	},
];

const meta = {
	title: "Rubrics/RubricTable",
	component: RubricTable,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: {
		rubrics: sampleRubrics,
		selectedRubricId: "q1",
		onSelectRubric: fn(),
		onCreate: fn(),
		onReorder: fn().mockResolvedValue(undefined),
	},
} satisfies Meta<typeof RubricTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = { args: { rubrics: [] } };
