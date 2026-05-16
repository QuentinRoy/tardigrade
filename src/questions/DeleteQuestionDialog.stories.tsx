import type { Meta, StoryObj } from "@storybook/nextjs";
import { expect, fn, screen, userEvent, waitFor } from "storybook/test";
import DeleteQuestionDialog from "./DeleteQuestionDialog";

const meta = {
  title: "Questions/DeleteQuestionDialog",
  component: DeleteQuestionDialog,
  tags: ["autodocs"],
  args: {
    open: true,
    question: {
      id: "q1",
      label: "Correctness",
      position: 0,
      assessmentCount: 5,
      rubricCount: 2,
      question: {
        label: "Correctness",
        rubrics: [],
      },
    },
    action: fn(),
    actionState: { status: "idle" },
    onClose: fn(),
  },
} satisfies Meta<typeof DeleteQuestionDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ConfirmationGate: Story = {
  play: async () => {
    const deleteButton = screen.getByRole("button", {
      name: /delete question/i,
    });

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
