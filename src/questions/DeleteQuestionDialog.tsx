"use client";

import {
	Alert,
	Button,
	Dialog,
	DialogActions,
	DialogContent,
	type DialogProps,
	DialogTitle,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import { type ReactElement, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import type { QuestionDefinition } from "#db/types.ts";
import type { QuestionsActionState } from "./state.ts";
import {
	buildDeleteConfirmationPhrase,
	matchesDeleteConfirmation,
} from "./useDeleteConfirmation.ts";

type DeleteQuestionDialogProps = {
	open: boolean;
	definition?: QuestionDefinition | undefined;
	action: (formData: FormData) => void;
	actionState: QuestionsActionState;
	onClose: () => void;
};

function DeleteButton({ disabled }: { disabled: boolean }): ReactElement {
	const { pending } = useFormStatus();

	return (
		<Button
			type="submit"
			color="error"
			variant="contained"
			disabled={disabled || pending}
		>
			{pending ? "Deleting..." : "Delete question"}
		</Button>
	);
}

export default function DeleteQuestionDialog({
	open,
	definition,
	action,
	actionState,
	onClose,
}: DeleteQuestionDialogProps): ReactElement {
	const [confirmationText, setConfirmationText] = useState("");

	const expectedPhrase = useMemo(() => {
		if (definition == null) {
			return "";
		}

		return buildDeleteConfirmationPhrase(
			definition.id,
			definition.assessmentCount,
		);
	}, [definition]);

	const isMatch = matchesDeleteConfirmation(confirmationText, expectedPhrase);
	const confirmationError = actionState.fieldErrors?.confirmationText;

	const payload = JSON.stringify({
		questionId: definition?.id,
		confirmationText,
		expectedPhrase,
	});

	const handleClose = () => {
		setConfirmationText("");
		onClose();
	};

	return (
		<Dialog open={open} onClose={handleClose} fullWidth maxWidth="sm">
			<DialogTitle>Delete Question</DialogTitle>
			<DialogContent>
				<Stack spacing={2} sx={{ pt: 1 }}>
					{definition == null ? null : (
						<>
							<Typography>
								This will delete question <strong>{definition.id}</strong> and
								cascade delete <strong>{definition.assessmentCount}</strong>{" "}
								linked assessments.
							</Typography>
							<Typography color="text.secondary">
								Type this phrase to confirm:
							</Typography>
							<Typography sx={{ fontFamily: "monospace" }}>
								{expectedPhrase}
							</Typography>
						</>
					)}

					{actionState.status === "error" &&
					actionState.formErrors != null &&
					actionState.formErrors.length > 0 ? (
						<Alert severity="error">{actionState.formErrors.join(" | ")}</Alert>
					) : null}

					{actionState.status === "success" && actionState.message != null ? (
						<Alert severity="success">{actionState.message}</Alert>
					) : null}

					<form action={action}>
						<Stack spacing={2}>
							<TextField
								label="Confirmation"
								value={confirmationText}
								onChange={(event) => setConfirmationText(event.target.value)}
								error={confirmationError != null}
								helperText={confirmationError ?? ""}
							/>
							<input name="payload" type="hidden" value={payload} />
							<DialogActions sx={{ px: 0 }}>
								<Button variant="outlined" onClick={handleClose}>
									Cancel
								</Button>
								<DeleteButton disabled={definition == null || !isMatch} />
							</DialogActions>
						</Stack>
					</form>
				</Stack>
			</DialogContent>
		</Dialog>
	);
}
