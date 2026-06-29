"use client";

import {
	Alert,
	Box,
	Button,
	List,
	ListItem,
	ListItemText,
	Stack,
	Typography,
} from "@mui/material";
import { type ReactElement, useActionState, useState } from "react";
import DeleteQuestionDialog from "./DeleteQuestionDialog.tsx";
import type { QuestionsActionState } from "./state.ts";
import { initialQuestionsActionState } from "./state.ts";
import type { QuestionDefinition } from "./types.ts";

type SelectedQuestionPaneProps = {
	definition?: QuestionDefinition | undefined;
	deleteAction: (
		state: QuestionsActionState,
		formData: FormData,
	) => Promise<QuestionsActionState>;
	onEdit: () => void;
	onDeleteSuccess: () => void;
};

export default function SelectedQuestionPane({
	definition,
	deleteAction,
	onEdit,
	onDeleteSuccess,
}: SelectedQuestionPaneProps): ReactElement {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteState, deleteFormAction] = useActionState(
		async (state: QuestionsActionState, formData: FormData) => {
			const result = await deleteAction(state, formData);
			if (result.status === "success") {
				setDeleteOpen(false);
				onDeleteSuccess();
			}
			return result;
		},
		initialQuestionsActionState,
	);

	return (
		<Stack spacing={2}>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Typography component="h2" variant="h5" sx={{ flex: 1 }}>
					Selected Question
				</Typography>
				<Button
					variant="outlined"
					disabled={definition == null}
					onClick={onEdit}
				>
					Edit
				</Button>
				<Button
					variant="outlined"
					color="error"
					disabled={definition == null}
					onClick={() => setDeleteOpen(true)}
				>
					Delete
				</Button>
			</Stack>

			{definition == null ? (
				<Alert severity="info">Select a question to inspect details.</Alert>
			) : (
				<Box>
					<Typography sx={{ mb: 1 }}>
						<strong>{definition.question.label ?? definition.id}</strong>
					</Typography>
					<Typography color="text.secondary" sx={{ mb: 1 }}>
						id: {definition.id}
					</Typography>
					<Typography color="text.secondary" sx={{ mb: 2 }}>
						{definition.question.rubrics.length} rubrics,{" "}
						{definition.assessmentCount} linked assessments
					</Typography>
					<List
						dense
						disablePadding
						sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
					>
						{definition.question.rubrics.map((rubric) => (
							<ListItem key={rubric.id} divider>
								<ListItemText
									primary={rubric.label ?? rubric.id}
									secondary={rubric.type}
								/>
							</ListItem>
						))}
					</List>
				</Box>
			)}

			<DeleteQuestionDialog
				open={deleteOpen}
				definition={definition}
				action={deleteFormAction}
				actionState={deleteState}
				onClose={() => setDeleteOpen(false)}
			/>
		</Stack>
	);
}
