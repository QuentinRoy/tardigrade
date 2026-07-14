"use client";

import { Box, Burger, Flex, Title } from "@mantine/core";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import AppLink from "#design-system/AppLink.tsx";
import { gridOverviewPath } from "#grids/gridPaths.ts";
import { getGridRouteContext } from "./AppShell.shared.ts";

const SIDE_ZONE_WIDTH = 48;

type AppShellTopBarProps =
	| {
			showNavigation: true;
			gridName: string;
			navbarOpened: boolean;
			onToggleNavbar: () => void;
			navbarId: string;
	  }
	| { showNavigation: false };

export default function AppShellTopBar(props: AppShellTopBarProps): ReactNode {
	const pathname = usePathname();
	const gridRouteContext = getGridRouteContext(pathname);
	const title = props.showNavigation ? props.gridName : "Tardigrade";
	const titleHref =
		props.showNavigation && gridRouteContext != null
			? gridOverviewPath(gridRouteContext)
			: undefined;

	return (
		<Flex h="100%" px="md" align="center">
			<Box w={SIDE_ZONE_WIDTH} flex="0 0 auto">
				{props.showNavigation ? (
					<Burger
						opened={props.navbarOpened}
						onClick={props.onToggleNavbar}
						hiddenFrom="sm"
						size="sm"
						aria-label={
							props.navbarOpened
								? "Close navigation drawer"
								: "Open navigation drawer"
						}
						aria-expanded={props.navbarOpened}
						aria-controls={props.navbarId}
					/>
				) : null}
			</Box>

			<Flex flex={1} justify="center">
				{titleHref != null ? (
					<AppLink href={titleHref} fz="md" fw={600} underline="never">
						{title}
					</AppLink>
				) : (
					<Title order={6} fz="md" fw={600}>
						{title}
					</Title>
				)}
			</Flex>

			<Box w={SIDE_ZONE_WIDTH} flex="0 0 auto" aria-hidden />
		</Flex>
	);
}
