import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { Suspense } from "react";
import CodeSnippet from "./CodeSnippet";

const meta = {
  title: "Shared/CodeSnippet",
  component: CodeSnippet,
  tags: ["autodocs"],
  parameters: { layout: "centered" },
  argTypes: {
    language: {
      control: "text",
      description:
        "Syntax highlighting language (e.g., typescript, bash, python)",
    },
  },
  args: {
    language: "typescript",
    children: `type Grade = {
  value: number;
  label: "A" | "B" | "C" | "D";
};

function calculateGrade(score: number): Grade {
  if (score >= 90) {
    return { value: 4, label: "A" };
  }
  if (score >= 80) {
    return { value: 3, label: "B" };
  } 
  if (score >= 70) {
    return { value: 2, label: "C" };
  }
  return { value: 1, label: "D" };
}

const grade = calculateGrade(85);`,
  },
  decorators: [
    (Story) => (
      <Suspense fallback={<div>Loading...</div>}>
        <Story />
      </Suspense>
    ),
  ],
} satisfies Meta<typeof CodeSnippet>;

export default meta;

type Story = StoryObj<typeof meta>;

export const TypeScript: Story = {};

export const Bash: Story = {
  args: {
    language: "bash",
    children: `pnpm prisma generate`,
  },
};

export const Python: Story = {
  args: {
    language: "python",
    children: `def fibonacci(n):
    if n <= 1:
        return n
    return fibonacci(n - 1) + fibonacci(n - 2)`,
  },
};

export const Css: Story = {
  args: {
    language: "css",
    children: `.container {
  display: flex;
  flex-direction: column;
}

.button {    
  background-color: blue;
  color: white;
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.button:hover {
  background-color: darkblue;
}`,
  },
};
