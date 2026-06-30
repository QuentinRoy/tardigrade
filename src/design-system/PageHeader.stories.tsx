import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AppLink from "./AppLink.tsx";
import PageHeader from "./PageHeader.tsx";

const meta = {
	title: "Shared/PageHeader",
	component: PageHeader,
	args: { title: "Submission 12" },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBreadcrumbs: Story = {
	args: {
		breadcrumbs: [
			<AppLink key="assessments" href="#">
				Assessments
			</AppLink>,
			"Submission 12",
		],
	},
};
