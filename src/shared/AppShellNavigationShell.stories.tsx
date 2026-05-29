import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { useState } from "react";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import AppShellNavigationShell from "./AppShellNavigationShell";

type NavigationShellStoryArgs = { showNavigation: boolean };

function ControlledNavigationShell({
	showNavigation,
}: NavigationShellStoryArgs) {
	const [drawerOpen, setDrawerOpen] = useState<boolean>(false);

	return (
		<AppShellNavigationShell
			showNavigation={showNavigation}
			drawerOpen={drawerOpen}
			onOpenDrawer={() => setDrawerOpen(true)}
			onCloseDrawer={() => setDrawerOpen(false)}
		/>
	);
}

const meta = {
	title: "Shared/AppShellNavigationShell",
	component: ControlledNavigationShell,
	parameters: {
		layout: "fullscreen",
		nextjs: { navigation: { pathname: "/projects/123/test-project" } },
	},
	args: { showNavigation: true },
} satisfies Meta<typeof ControlledNavigationShell>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

// Full open/close interaction flow is tested in AppShellNavigationShell.stories.
// This story just verifies that AppShell wires the toggle button correctly.
export const DrawerOpens: Story = {
	play: async () => {
		const hamburger = screen.getByRole("button", {
			name: /open navigation drawer/i,
		});

		await expect(hamburger).toHaveAttribute("aria-expanded", "false");
		await expect(hamburger).toHaveAttribute("aria-controls");

		await userEvent.click(hamburger);

		await expect(hamburger).toHaveAttribute("aria-expanded", "true");
		// Button label switches to close when drawer is open
		await expect(hamburger).toHaveAttribute(
			"aria-label",
			"Close navigation drawer",
		);
		await expect(await screen.findByRole("dialog")).toBeVisible();
	},
};

export const DrawerOpenCloseFlow: Story = {
	play: async () => {
		const hamburger = screen.getByRole("button", {
			name: /open navigation drawer/i,
		});

		await expect(hamburger).toHaveAttribute("aria-expanded", "false");
		await expect(hamburger).toHaveAttribute("aria-controls");

		await userEvent.click(hamburger);

		await expect(hamburger).toHaveAttribute("aria-expanded", "true");
		// Button label toggles to close when drawer is open
		await expect(hamburger).toHaveAttribute(
			"aria-label",
			"Close navigation drawer",
		);
		// MUI Drawer renders its panel as role="dialog" inside a portal;
		// it's accessible (not aria-hidden) when the drawer is open.
		await expect(await screen.findByRole("dialog")).toBeVisible();

		await userEvent.click(hamburger);

		// When closed with keepMounted: true, MUI sets aria-hidden on the portal,
		// so queryByRole (which excludes aria-hidden by default) returns null.
		await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		await expect(hamburger).toHaveAttribute("aria-expanded", "false");
	},
};
