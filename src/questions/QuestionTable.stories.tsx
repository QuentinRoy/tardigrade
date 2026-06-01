import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import type { QuestionDefinition } from "#db/types.ts";
import QuestionTable from "./QuestionTable.tsx";

const sampleQuestions: QuestionDefinition[] = [
	{
		id: "q1",
		position: 0,
		assessmentCount: 12,
		question: { label: "Correctness", rubrics: [] },
	},
	{
		id: "q2",
		position: 1,
		assessmentCount: 8,
		question: { label: "Code Quality", rubrics: [] },
	},
];

const meta = {
	title: "Questions/QuestionTable",
	component: QuestionTable,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: {
		questions: sampleQuestions,
		selectedQuestionId: "q1",
		onSelectQuestion: fn(),
		onCreate: fn(),
		onReorder: fn().mockResolvedValue(undefined),
	},
} satisfies Meta<typeof QuestionTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = { args: { questions: [] } };
