"use client";

import { Button, type ButtonProps } from "@mantine/core";
import NextLink from "next/link";
import type { ReactNode } from "react";

type AppButtonLinkProps = Omit<ButtonProps, "component" | "href"> & {
	href: string;
	children: ReactNode;
};

export default function AppButtonLink({ href, ...props }: AppButtonLinkProps) {
	return <Button component={NextLink} href={href} {...props} />;
}
