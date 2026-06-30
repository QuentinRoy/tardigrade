import { Text } from "@mantine/core";
import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import Panel from "./Panel.tsx";

const meta = {
	title: "Shared/Panel",
	component: Panel,
	args: { children: <Text>Panel content</Text> },
} satisfies Meta<typeof Panel>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
