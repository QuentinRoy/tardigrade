import darkTheme from "@shikijs/themes/night-owl";
import lightTheme from "@shikijs/themes/night-owl-light";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

// Lazy-loaded highlighter instance
let highlighterPromise: Promise<
	Awaited<ReturnType<typeof createHighlighterCore>>
> | null = null;

export async function getHighlighter(): Promise<
	Awaited<ReturnType<typeof createHighlighterCore>>
> {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [lightTheme, darkTheme],
			langs: [
				import("@shikijs/langs/javascript"),
				import("@shikijs/langs/typescript"),
				import("@shikijs/langs/bash"),
				import("@shikijs/langs/python"),
				import("@shikijs/langs/jsx"),
				import("@shikijs/langs/tsx"),
				import("@shikijs/langs/css"),
			],
			engine: createJavaScriptRegexEngine(),
		});
	}
	return highlighterPromise;
}
