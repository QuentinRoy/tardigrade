"use client";

import { NavLink, type NavLinkProps } from "@mantine/core";
import NextLink from "next/link";

type AppNavLinkProps = Omit<NavLinkProps, "component" | "href"> & {
	href: string;
};

export default function AppNavLink({ href, ...props }: AppNavLinkProps) {
	return <NavLink component={NextLink} href={href} {...props} />;
}
