import "@fontsource/monaspace-neon";

import Box from "@mui/material/Box";
import type React from "react";
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
			{/** biome-ignore lint/security/noDangerouslySetInnerHtml: This is fine here,
			  we generate the HTML safely from shiki highlighter. */}
			<Box className="code" dangerouslySetInnerHTML={{ __html: html }} />
		</Box>
	);
}
