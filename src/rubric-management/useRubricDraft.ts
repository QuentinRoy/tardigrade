"use client";

import { useEffect, useState } from "react";
import {
	createEmptyRubricEditorValue,
	type RubricEditorValue,
} from "./types.ts";

export function useRubricDraft(initialValue?: RubricEditorValue) {
	const [draft, setDraft] = useState<RubricEditorValue>(
		initialValue ?? createEmptyRubricEditorValue(),
	);

	useEffect(() => {
		if (initialValue != null) {
			setDraft(initialValue);
			return;
		}

		setDraft(createEmptyRubricEditorValue());
	}, [initialValue]);

	return {
		draft,
		setDraft,
		resetDraft: () => setDraft(initialValue ?? createEmptyRubricEditorValue()),
	};
}
