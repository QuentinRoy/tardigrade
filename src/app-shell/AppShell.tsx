"use client";

import { AppShell as MantineAppShell, ScrollArea } from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { type ReactNode, Suspense, useId } from "react";
import { APP_SHELL_DRAWER_WIDTH } from "./AppShell.shared.ts";
import AppShellDrawerContent from "./AppShellDrawerContent.tsx";
import AppShellLoadingShell from "./AppShellLoadingShell.tsx";
import AppShellTopBar from "./AppShellTopBar.tsx";

type AppShellProps =
	| { showNavigation: true; gridName: string; children: ReactNode }
	| { showNavigation?: false; children: ReactNode };

export default function AppShell(props: AppShellProps) {
	const { children } = props;
	const showNavigation = props.showNavigation ?? false;
	const [navbarOpened, { toggle: toggleNavbar, close: closeNavbar }] =
		useDisclosure(false);
	const navbarId = useId();

	return (
		<MantineAppShell
			header={{ height: { base: 56, sm: 64 } }}
			{...(showNavigation
				? {
						navbar: {
							width: APP_SHELL_DRAWER_WIDTH,
							breakpoint: "sm",
							collapsed: { mobile: !navbarOpened },
						},
					}
				: {})}
		>
			<MantineAppShell.Header>
				<Suspense
					fallback={<AppShellLoadingShell showNavigation={showNavigation} />}
				>
					{props.showNavigation ? (
						<AppShellTopBar
							showNavigation
							gridName={props.gridName}
							navbarOpened={navbarOpened}
							onToggleNavbar={toggleNavbar}
							navbarId={navbarId}
						/>
					) : (
						<AppShellTopBar showNavigation={false} />
					)}
				</Suspense>
			</MantineAppShell.Header>

			{props.showNavigation && (
				<MantineAppShell.Navbar id={navbarId} aria-label="Grid navigation">
					{/*
						AppShell.Navbar doesn't scroll on its own, and its content
						(import/export sections included) can be taller than the
						viewport — wrap it in a growing ScrollArea section so
						everything stays reachable.
					*/}
					<MantineAppShell.Section grow component={ScrollArea}>
						<Suspense fallback={null}>
							<AppShellDrawerContent
								gridName={props.gridName}
								onDismiss={closeNavbar}
							/>
						</Suspense>
					</MantineAppShell.Section>
				</MantineAppShell.Navbar>
			)}

			<MantineAppShell.Main>{children}</MantineAppShell.Main>
		</MantineAppShell>
	);
}
