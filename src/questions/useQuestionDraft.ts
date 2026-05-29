"use client";

import { useEffect, useState } from "react";
import {
	createEmptyQuestionEditorValue,
	type QuestionEditorValue,
} from "./types";

export function useQuestionDraft(initialValue?: QuestionEditorValue) {
	const [draft, setDraft] = useState<QuestionEditorValue>(
		initialValue ?? createEmptyQuestionEditorValue(),
	);

	useEffect(() => {
		if (initialValue != null) {
			setDraft(initialValue);
			return;
		}

		setDraft(createEmptyQuestionEditorValue());
	}, [initialValue]);

	return {
		draft,
		setDraft,
		resetDraft: () =>
			setDraft(initialValue ?? createEmptyQuestionEditorValue()),
	};
}
