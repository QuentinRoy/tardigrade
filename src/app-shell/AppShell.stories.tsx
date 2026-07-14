import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent } from "storybook/test";
import AppShell from "./AppShell.tsx";

const meta = {
	title: "Shared/AppShell",
	component: AppShell,
	parameters: {
		layout: "fullscreen",
		nextjs: { navigation: { pathname: "/grids/123/test-grid" } },
	},
	args: { showNavigation: true, children: <p>Page content</p> },
} satisfies Meta<typeof AppShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WithNavigation: Story = {
	play: async () => {
		// At the default (desktop) test viewport, the navbar is permanently
		// visible and the burger (mobile-only) isn't rendered.
		await expect(
			screen.getByRole("navigation", { name: /grid navigation/i }),
		).toBeVisible();
		expect(
			screen.queryByRole("button", { name: /open navigation drawer/i }),
		).toBeNull();
	},
};

export const WithoutNavigation: Story = { args: { showNavigation: false } };

export const ExportOptionsPersist: Story = {
	play: async () => {
		const criterionMarksCheckbox = screen.getByRole("checkbox", {
			name: "Criterion marks",
		});

		await expect(criterionMarksCheckbox).not.toBeChecked();

		await userEvent.click(criterionMarksCheckbox);

		await expect(criterionMarksCheckbox).toBeChecked();
	},
};
