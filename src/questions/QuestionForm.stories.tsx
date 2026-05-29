import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { fn } from "storybook/test";
import QuestionForm from "./QuestionForm";

const meta = {
	title: "Questions/QuestionForm",
	component: QuestionForm,
	tags: ["autodocs"],
	parameters: { layout: "padded" },
	args: {
		mode: "create",
		originalQuestionId: undefined,
		action: fn(),
		actionState: { status: "idle" },
		initialValue: {
			id: "q1",
			label: "Correctness",
			rubrics: [{ id: "q1-pass", type: "boolean", marks: 1, falseMarks: 0 }],
		},
		onCancel: fn(),
	},
} satisfies Meta<typeof QuestionForm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Create: Story = {};

export const Edit: Story = { args: { mode: "edit", originalQuestionId: "q1" } };

export const WithErrors: Story = {
	args: {
		actionState: {
			status: "error",
			fieldErrors: { rubrics: [{ id: "Rubric ids must be unique." }] },
			formErrors: [],
		},
	},
};
