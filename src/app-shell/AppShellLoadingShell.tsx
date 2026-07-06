"use client";

import { Box, Flex, Title } from "@mantine/core";
import type { ReactNode } from "react";

const SIDE_ZONE_WIDTH = 48;

type AppShellLoadingShellProps = { showNavigation: boolean };

export default function AppShellLoadingShell({
	showNavigation,
}: AppShellLoadingShellProps): ReactNode {
	return (
		<Flex h="100%" px="md" align="center">
			<Box w={SIDE_ZONE_WIDTH} flex="0 0 auto" />
			<Flex flex={1} justify="center">
				<Title order={6} fz="md" fw={600}>
					{showNavigation ? "Project" : "BonPoint"}
				</Title>
			</Flex>
			<Box w={SIDE_ZONE_WIDTH} flex="0 0 auto" aria-hidden />
		</Flex>
	);
}
