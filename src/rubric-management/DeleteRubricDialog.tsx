"use client";

import {
	Alert,
	Button,
	Code,
	Group,
	Modal,
	Stack,
	Text,
	TextInput,
} from "@mantine/core";
import { type ReactElement, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { RubricsActionState } from "./state.ts";
import type { RubricDefinition } from "./types.ts";
import {
	buildDeleteConfirmationPhrase,
	matchesDeleteConfirmation,
} from "./useDeleteConfirmation.ts";

type DeleteRubricDialogProps = {
	open: boolean;
	definition?: RubricDefinition | undefined;
	action: (formData: FormData) => void;
	actionState: RubricsActionState;
	onClose: () => void;
};

function DeleteButton({ disabled }: { disabled: boolean }): ReactElement {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" color="red" loading={pending} disabled={disabled}>
			Delete rubric
		</Button>
	);
}

export default function DeleteRubricDialog({
	open,
	definition,
	action,
	actionState,
	onClose,
}: DeleteRubricDialogProps): ReactElement {
	const [confirmationText, setConfirmationText] = useState("");

	const expectedPhrase = useMemo(() => {
		if (definition == null) return "";
		return buildDeleteConfirmationPhrase(
			definition.id,
			definition.gradedTargetCount,
		);
	}, [definition]);

	const isMatch = matchesDeleteConfirmation(confirmationText, expectedPhrase);
	const confirmationError = actionState.fieldErrors?.confirmationText;

	const payload = JSON.stringify({
		rubricId: definition?.id,
		confirmationText,
		expectedPhrase,
	});

	const handleClose = () => {
		setConfirmationText("");
		onClose();
	};

	return (
		<Modal opened={open} onClose={handleClose} title="Delete Rubric" size="sm">
			<form action={action}>
				<Stack gap="md">
					{definition != null ? (
						<>
							<Text>
								This will delete rubric <strong>{definition.id}</strong> and
								cascade delete <strong>{definition.gradedTargetCount}</strong>{" "}
								linked grades.
							</Text>
							<Text c="dimmed">Type this phrase to confirm:</Text>
							<Code block>{expectedPhrase}</Code>
						</>
					) : null}

					{actionState.status === "error" &&
					actionState.formErrors != null &&
					actionState.formErrors.length > 0 ? (
						<Alert color="red" variant="light">
							{actionState.formErrors.join(" | ")}
						</Alert>
					) : null}

					{actionState.status === "success" && actionState.message != null ? (
						<Alert color="green" variant="light">
							{actionState.message}
						</Alert>
					) : null}

					<TextInput
						label="Confirmation"
						value={confirmationText}
						onChange={(event) => setConfirmationText(event.currentTarget.value)}
						error={confirmationError}
					/>

					<input name="payload" type="hidden" value={payload} />

					<Group justify="flex-end">
						<Button variant="outline" onClick={handleClose}>
							Cancel
						</Button>
						<DeleteButton disabled={definition == null || !isMatch} />
					</Group>
				</Stack>
			</form>
		</Modal>
	);
}
