"use client";

import MuiLink, { type LinkProps as MuiLinkProps } from "@mui/material/Link";
import NextLink from "next/link";

type MuiNextLinkProps = Omit<
	MuiLinkProps<typeof NextLink>,
	"component" | "href"
> & { href: string };

export default function MuiNextLink({ href, ...props }: MuiNextLinkProps) {
	return <MuiLink component={NextLink} href={href} {...props} />;
}
