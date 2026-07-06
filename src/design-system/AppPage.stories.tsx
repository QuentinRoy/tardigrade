import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AppPage from "./AppPage.tsx";

const meta = {
	title: "Shared/AppPage",
	component: AppPage,
	args: { children: <Text>Page content</Text> },
} satisfies Meta<typeof AppPage>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Wide: Story = { args: { size: "lg" } };
