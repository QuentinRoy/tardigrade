import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import { expect, spyOn, waitFor } from "storybook/test";
import CosmeticSlugReplacement from "./CosmeticSlugReplacement.tsx";

const projectId = "p-abc123";

const meta = {
	title: "Shared/CosmeticSlugReplacement",
	component: CosmeticSlugReplacement,
	args: { idIndex: 2, id: projectId, slug: "cs101" },
} satisfies Meta<typeof CosmeticSlugReplacement>;

export default meta;

type Story = StoryObj<typeof meta>;

export const StaleSlugIsCorrected: Story = {
	parameters: {
		nextjs: { navigation: { pathname: `/projects/${projectId}/old-name` } },
	},
	// `mount` defers rendering so the spy is installed before the component's
	// mount-effect runs; `using` restores the real replaceState on play exit.
	play: async ({ mount }) => {
		using replaceState = spyOn(
			window.history,
			"replaceState",
		).mockReturnValue();
		await mount();

		await waitFor(() => expect(replaceState).toHaveBeenCalled());
		const replacedUrl = replaceState.mock.calls.at(-1)?.[2];
		expect(replacedUrl).toContain(`/projects/${projectId}/cs101`);
	},
};

export const CanonicalSlugIsLeftAlone: Story = {
	parameters: {
		nextjs: { navigation: { pathname: `/projects/${projectId}/cs101` } },
	},
	play: async ({ mount }) => {
		using replaceState = spyOn(
			window.history,
			"replaceState",
		).mockReturnValue();
		await mount();

		expect(replaceState).not.toHaveBeenCalled();
	},
};
