import "@fontsource/monaspace-neon";

import Box from "@mui/material/Box";
import React from "react";
import { getHighlighter } from "./shiki-setup";

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
		<Box
			sx={{
				borderRadius: 1,
				overflow: "hidden",
				"& pre": {
					margin: 0,
					padding: 2,
					fontFamily: "'Monaspace Neon', monospace",
				},
				"& code": { fontFamily: "'Monaspace Neon', monospace" },
			}}
		>
			<Box className="code" dangerouslySetInnerHTML={{ __html: html }} />
		</Box>
	);
}
