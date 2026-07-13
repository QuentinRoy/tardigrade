import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, screen, userEvent, waitFor } from "storybook/test";
import { useGradeTargetQuickJump } from "./useGradeTargetQuickJump.ts";

// Small harness so the hook's surface (the Cmd/Ctrl+K shortcut and the
// open/close state it returns) can be exercised by a play function. The
// real dialog handles Escape itself; the hook only owns open/close.
function QuickJumpHarness() {
	const { isOpen, open, close } = useGradeTargetQuickJump();
	return (
		<div>
			<input aria-label="Comment" />
			<button type="button" onClick={open}>
				Open lookup
			</button>
			<button type="button" onClick={close}>
				Close lookup
			</button>
			<p>{isOpen ? "Lookup open" : "Lookup closed"}</p>
		</div>
	);
}

const meta = {
	title: "Grade/useGradeTargetQuickJump",
	component: QuickJumpHarness,
} satisfies Meta<typeof QuickJumpHarness>;

export default meta;

type Story = StoryObj<typeof meta>;

export const OpensOnMetaShortcut: Story = {
	play: async () => {
		await expect(screen.getByText("Lookup closed")).toBeVisible();

		await userEvent.keyboard("{Meta>}k{/Meta}");

		await waitFor(() => expect(screen.getByText("Lookup open")).toBeVisible());
	},
};

export const OpensOnCtrlShortcut: Story = {
	play: async () => {
		await expect(screen.getByText("Lookup closed")).toBeVisible();

		await userEvent.keyboard("{Control>}k{/Control}");

		await waitFor(() => expect(screen.getByText("Lookup open")).toBeVisible());
	},
};

export const IgnoresMetaShortcutWhileTyping: Story = {
	play: async () => {
		await userEvent.click(screen.getByLabelText("Comment"));
		await userEvent.keyboard("{Meta>}k{/Meta}");

		await expect(screen.getByText("Lookup closed")).toBeVisible();
	},
};

export const IgnoresCtrlShortcutWhileTyping: Story = {
	play: async () => {
		await userEvent.click(screen.getByLabelText("Comment"));
		await userEvent.keyboard("{Control>}k{/Control}");

		await expect(screen.getByText("Lookup closed")).toBeVisible();
	},
};

export const OpenAndCloseControls: Story = {
	play: async () => {
		await userEvent.click(screen.getByRole("button", { name: "Open lookup" }));
		await expect(screen.getByText("Lookup open")).toBeVisible();

		await userEvent.click(screen.getByRole("button", { name: "Close lookup" }));
		await expect(screen.getByText("Lookup closed")).toBeVisible();
	},
};
