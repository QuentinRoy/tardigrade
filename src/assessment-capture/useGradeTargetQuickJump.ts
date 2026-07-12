"use client";

import { useEffect, useState } from "react";

export type UseGradeTargetQuickJumpResult = {
	isOpen: boolean;
	open: () => void;
	close: () => void;
};

// Owns the grade-target quick-jump dialog's open state plus the global Cmd/Ctrl+K
// shortcut that opens it. The shortcut is a window-level subscription (focus can
// be anywhere on the page, so a JSX onKeyDown cannot capture it), which is the
// legitimate "subscribe to an external system" use of useEffect: it registers
// the listener once and cleans it up on unmount. The handler reads no reactive
// values, so the dependency array stays empty.
export function useGradeTargetQuickJump(): UseGradeTargetQuickJumpResult {
	const [isOpen, setOpen] = useState(false);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			const isShortcut =
				(event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k";

			if (!isShortcut) {
				return;
			}

			const eventTarget = event.target;
			if (eventTarget instanceof HTMLElement) {
				const tagName = eventTarget.tagName.toLowerCase();
				if (
					eventTarget.isContentEditable ||
					tagName === "input" ||
					tagName === "textarea"
				) {
					return;
				}
			}

			event.preventDefault();
			setOpen(true);
		};

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, []);

	return { isOpen, open: () => setOpen(true), close: () => setOpen(false) };
}
