"use client";

import {
	Alert,
	Box,
	Button,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { type ReactElement, useMemo } from "react";
import { useFormStatus } from "react-dom";
import RubricEditorList from "./RubricEditorList.tsx";
import type { QuestionsActionState } from "./state.ts";
import type { QuestionEditorValue } from "./types.ts";
import { useQuestionDraft } from "./useQuestionDraft.ts";

type QuestionFormProps = {
	mode: "create" | "edit";
	originalQuestionId?: string | undefined;
	initialValue?: QuestionEditorValue | undefined;
	action: (formData: FormData) => void;
	actionState: QuestionsActionState;
	onCancel: () => void;
};

function SubmitButton({
	mode,
	disabled,
}: {
	mode: "create" | "edit";
	disabled: boolean;
}): ReactElement {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" variant="contained" disabled={disabled || pending}>
			{pending
				? "Saving..."
				: mode === "create"
					? "Create question"
					: "Save changes"}
		</Button>
	);
}

export default function QuestionForm({
	mode,
	originalQuestionId,
	initialValue,
	action,
	actionState,
	onCancel,
}: QuestionFormProps): ReactElement {
	const { draft, setDraft } = useQuestionDraft(initialValue);

	const payload = useMemo(
		() => ({
			originalId: mode === "edit" ? originalQuestionId : undefined,
			id: draft.id,
			label: draft.label,
			rubrics: draft.rubrics,
		}),
		[draft, mode, originalQuestionId],
	);

	const questionIdError =
		actionState.fieldErrors?.questionId ??
		(draft.id.trim().length === 0 ? "Question id is required" : undefined);

	return (
		<Box component="form" action={action}>
			<Stack spacing={2}>
				<Typography variant="h5" component="h2">
					{mode === "create" ? "Create Question" : "Edit Question"}
				</Typography>

				{actionState.status === "success" && actionState.message != null ? (
					<Alert severity="success">{actionState.message}</Alert>
				) : null}

				{actionState.status === "error" &&
				actionState.formErrors != null &&
				actionState.formErrors.length > 0 ? (
					<Alert severity="error">{actionState.formErrors.join(" | ")}</Alert>
				) : null}

				<TextField
					label="Question id"
					value={draft.id}
					onChange={(event) =>
						setDraft((previous) => ({ ...previous, id: event.target.value }))
					}
					error={questionIdError != null}
					helperText={questionIdError ?? ""}
					required
				/>

				<TextField
					label="Question label"
					value={draft.label ?? ""}
					onChange={(event) =>
						setDraft((previous) => ({ ...previous, label: event.target.value }))
					}
				/>

				<RubricEditorList
					rubrics={draft.rubrics}
					onChange={(rubrics) =>
						setDraft((previous) => ({ ...previous, rubrics }))
					}
					fieldErrors={actionState.fieldErrors?.rubrics}
				/>

				<input name="payload" type="hidden" value={JSON.stringify(payload)} />

				<Stack direction="row" spacing={1}>
					<SubmitButton mode={mode} disabled={draft.id.trim().length === 0} />
					<Button variant="outlined" onClick={onCancel}>
						Cancel
					</Button>
				</Stack>
			</Stack>
		</Box>
	);
}
