import { Container, type ContainerProps } from "@mantine/core";
import type { ReactElement } from "react";

type AppPageProps = Pick<ContainerProps, "size"> & {
	children: ContainerProps["children"];
};

/** Top-level page container: consistent max width and vertical padding. */
export default function AppPage({
	size = "md",
	children,
}: AppPageProps): ReactElement {
	return (
		<Container component="main" size={size} py="xl">
			{children}
		</Container>
	);
}
