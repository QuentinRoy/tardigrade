"use client";

import { Anchor, type AnchorProps } from "@mantine/core";
import NextLink from "next/link";
import type { ReactNode } from "react";

type AppLinkProps = Omit<AnchorProps, "component" | "href"> & {
	href: string;
	children: ReactNode;
};

export default function AppLink({ href, ...props }: AppLinkProps) {
	return <Anchor component={NextLink} href={href} {...props} />;
}
