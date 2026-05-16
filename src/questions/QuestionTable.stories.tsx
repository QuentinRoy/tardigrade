import type { Meta, StoryObj } from "@storybook/nextjs";
import { fn } from "storybook/test";
import QuestionTable from "./QuestionTable";
import type { QuestionManagementItem } from "./types";

const sampleQuestions: QuestionManagementItem[] = [
  {
    id: "q1",
    label: "Correctness",
    position: 0,
    assessmentCount: 12,
    rubricCount: 2,
    question: {
      label: "Correctness",
      rubrics: [],
    },
  },
  {
    id: "q2",
    label: "Code Quality",
    position: 1,
    assessmentCount: 8,
    rubricCount: 3,
    question: {
      label: "Code Quality",
      rubrics: [],
    },
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
  },
} satisfies Meta<typeof QuestionTable>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Populated: Story = {};

export const Empty: Story = {
  args: {
    questions: [],
  },
};
