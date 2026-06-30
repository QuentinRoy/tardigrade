import { Box, Breadcrumbs, Title } from "@mantine/core";
import type { ReactElement, ReactNode } from "react";

type PageHeaderProps = { title: ReactNode; breadcrumbs?: ReactNode[] };

/** Page heading with an optional breadcrumb trail above the title. */
export default function PageHeader({
	title,
	breadcrumbs,
}: PageHeaderProps): ReactElement {
	return (
		<Box component="header" mb="md">
			{breadcrumbs != null && breadcrumbs.length > 0 && (
				<Breadcrumbs mb="xs">{breadcrumbs}</Breadcrumbs>
			)}
			<Title order={1}>{title}</Title>
		</Box>
	);
}
