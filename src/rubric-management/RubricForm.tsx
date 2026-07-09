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
import CriterionEditorList from "./CriterionEditorList.tsx";
import type { RubricsActionState } from "./state.ts";
import type { RubricEditorValue } from "./types.ts";
import { createEmptyRubricEditorValue } from "./types.ts";

type RubricFormProps = {
	mode: "create" | "edit";
	originalRubricId?: string | undefined;
	initialValue?: RubricEditorValue | undefined;
	action: (formData: FormData) => void;
	actionState: RubricsActionState;
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
			{mode === "create" ? "Create rubric" : "Save changes"}
		</Button>
	);
}

export default function RubricForm({
	mode,
	originalRubricId,
	initialValue,
	action,
	actionState,
	onCancel,
}: RubricFormProps): ReactElement {
	const form = useForm<RubricEditorValue>({
		mode: "controlled",
		initialValues: initialValue ?? createEmptyRubricEditorValue(),
		validateInputOnChange: ["id"],
		validate: {
			id: (value) =>
				value.trim().length === 0 ? "Rubric id is required" : null,
		},
	});

	const payload = useMemo(
		() => ({
			originalId: mode === "edit" ? originalRubricId : undefined,
			...form.values,
		}),
		[form.values, mode, originalRubricId],
	);

	const rubricIdError = actionState.fieldErrors?.rubricId ?? form.errors["id"];

	return (
		<Box component="form" action={action}>
			<Stack gap="md">
				<Title order={2}>
					{mode === "create" ? "Create Rubric" : "Edit Rubric"}
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
					label="Rubric id"
					required
					{...form.getInputProps("id")}
					error={rubricIdError}
				/>

				<TextInput label="Rubric label" {...form.getInputProps("label")} />

				<CriterionEditorList
					criteria={form.values.criteria}
					onChange={(criteria) => form.setFieldValue("criteria", criteria)}
					fieldErrors={actionState.fieldErrors?.criteria}
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
