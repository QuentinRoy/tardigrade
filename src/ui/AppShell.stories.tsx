import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AppShell from "./AppShell.tsx";

const meta = {
	title: "Shared/AppShell",
	component: AppShell,
	parameters: {
		layout: "fullscreen",
		nextjs: { navigation: { pathname: "/projects/123/test-project" } },
	},
	args: { showNavigation: true, children: <p>Page content</p> },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithNavigation: Story = {};

export const WithoutNavigation: Story = { args: { showNavigation: false } };
