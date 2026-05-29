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
import DeleteQuestionDialog from "./DeleteQuestionDialog";
import { initialQuestionsActionState } from "./state";
import type { QuestionManagementItem } from "./types";

type SelectedQuestionPaneProps = {
	question?: QuestionManagementItem;
	deleteAction: (
		state: import("./state").QuestionsActionState,
		formData: FormData,
	) => Promise<import("./state").QuestionsActionState>;
	onEdit: () => void;
	onDeleteSuccess: () => void;
};

export default function SelectedQuestionPane({
	question,
	deleteAction,
	onEdit,
	onDeleteSuccess,
}: SelectedQuestionPaneProps): ReactElement {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteState, deleteFormAction] = useActionState(
		deleteAction,
		initialQuestionsActionState,
	);

	if (deleteState.status === "success") {
		onDeleteSuccess();
	}

	return (
		<Stack spacing={2}>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Typography component="h2" variant="h5" sx={{ flex: 1 }}>
					Selected Question
				</Typography>
				<Button variant="outlined" disabled={question == null} onClick={onEdit}>
					Edit
				</Button>
				<Button
					variant="outlined"
					color="error"
					disabled={question == null}
					onClick={() => setDeleteOpen(true)}
				>
					Delete
				</Button>
			</Stack>

			{question == null ? (
				<Alert severity="info">Select a question to inspect details.</Alert>
			) : (
				<Box>
					<Typography sx={{ mb: 1 }}>
						<strong>{question.label ?? question.id}</strong>
					</Typography>
					<Typography color="text.secondary" sx={{ mb: 1 }}>
						id: {question.id}
					</Typography>
					<Typography color="text.secondary" sx={{ mb: 2 }}>
						{question.rubricCount} rubrics, {question.assessmentCount} linked
						assessments
					</Typography>
					<List
						dense
						disablePadding
						sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
					>
						{question.question.rubrics.map((rubric) => (
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
				question={question}
				action={deleteFormAction}
				actionState={deleteState}
				onClose={() => setDeleteOpen(false)}
			/>
		</Stack>
	);
}
