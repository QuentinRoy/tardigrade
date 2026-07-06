"use client";

import {
	Alert,
	Box,
	Button,
	Group,
	Stack,
	TextInput,
	Title,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { type ReactElement, useMemo } from "react";
import { useFormStatus } from "react-dom";
import RubricEditorList from "./RubricEditorList.tsx";
import type { QuestionsActionState } from "./state.ts";
import type { QuestionEditorValue } from "./types.ts";
import { createEmptyQuestionEditorValue } from "./types.ts";

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
		<Button type="submit" loading={pending} disabled={disabled}>
			{mode === "create" ? "Create question" : "Save changes"}
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
	const form = useForm<QuestionEditorValue>({
		mode: "controlled",
		initialValues: initialValue ?? createEmptyQuestionEditorValue(),
		validateInputOnChange: ["id"],
		validate: {
			id: (value) =>
				value.trim().length === 0 ? "Question id is required" : null,
		},
	});

	const payload = useMemo(
		() => ({
			originalId: mode === "edit" ? originalQuestionId : undefined,
			...form.values,
		}),
		[form.values, mode, originalQuestionId],
	);

	const questionIdError =
		actionState.fieldErrors?.questionId ?? form.errors["id"];

	return (
		<Box component="form" action={action}>
			<Stack gap="md">
				<Title order={2}>
					{mode === "create" ? "Create Question" : "Edit Question"}
				</Title>

				{actionState.status === "success" && actionState.message != null ? (
					<Alert color="green" variant="light">
						{actionState.message}
					</Alert>
				) : null}

				{actionState.status === "error" &&
				actionState.formErrors != null &&
				actionState.formErrors.length > 0 ? (
					<Alert color="red" variant="light">
						{actionState.formErrors.join(" | ")}
					</Alert>
				) : null}

				<TextInput
					label="Question id"
					required
					{...form.getInputProps("id")}
					error={questionIdError}
				/>

				<TextInput label="Question label" {...form.getInputProps("label")} />

				<RubricEditorList
					rubrics={form.values.rubrics}
					onChange={(rubrics) => form.setFieldValue("rubrics", rubrics)}
					fieldErrors={actionState.fieldErrors?.rubrics}
				/>

				<input name="payload" type="hidden" value={JSON.stringify(payload)} />

				<Group>
					<SubmitButton
						mode={mode}
						disabled={form.values.id.trim().length === 0}
					/>
					<Button variant="outline" onClick={onCancel}>
						Cancel
					</Button>
				</Group>
			</Stack>
		</Box>
	);
}
