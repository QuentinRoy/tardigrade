"use client";

import { useEffect } from "react";

/**
 * Warn before reload/close while `active` is true (e.g. a save is in flight).
 */
export function useBeforeUnloadGuard(active: boolean): void {
	useEffect(() => {
		if (!active) {
			return;
		}

		const onBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			// Legacy browsers require returnValue to be set to show the prompt.
			event.returnValue = "";
		};

		window.addEventListener("beforeunload", onBeforeUnload);
		return () => window.removeEventListener("beforeunload", onBeforeUnload);
	}, [active]);
}
