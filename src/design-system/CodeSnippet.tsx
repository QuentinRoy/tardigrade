import "@fontsource/monaspace-neon";

import { Box } from "@mantine/core";
import type React from "react";
import classes from "./CodeSnippet.module.css";
import { getHighlighter } from "./shiki-setup.ts";

type CodeSnippetProps = { children: string; language?: string };

export default async function CodeSnippet({
	children,
	language = "javascript",
}: CodeSnippetProps): Promise<React.ReactElement> {
	const highlighter = await getHighlighter();
	const code = children.trim();

	const html = await highlighter.codeToHtml(code, {
		lang: language,
		themes: { light: "night-owl-light", dark: "night-owl" },
	});

	return (
		<Box className={classes.root}>
			<Box
				className={classes.inner}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: HTML is generated safely from the shiki highlighter.
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</Box>
	);
}
