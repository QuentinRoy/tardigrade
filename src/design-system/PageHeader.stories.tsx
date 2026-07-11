import type { Meta, StoryObj } from "@storybook/nextjs-vite";
import AppLink from "./AppLink.tsx";
import PageHeader from "./PageHeader.tsx";

const meta = {
	title: "Shared/PageHeader",
	component: PageHeader,
	args: { title: "Alice Smith" },
} satisfies Meta<typeof PageHeader>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBreadcrumbs: Story = {
	args: {
		breadcrumbs: [
			<AppLink key="grades" href="#">
				Grades
			</AppLink>,
			"Alice Smith",
		],
	},
};
