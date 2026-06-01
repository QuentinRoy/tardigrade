"use client";

import { Box, Container, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import {
	type ReactElement,
	useActionState,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { QuestionDefinition } from "#db/types.ts";
import { reorderQuestionsAction, saveQuestionAction } from "./actions.ts";
import QuestionForm from "./QuestionForm.tsx";
import QuestionTable from "./QuestionTable.tsx";
import SelectedQuestionPane from "./SelectedQuestionPane.tsx";
import type { QuestionsActionState } from "./state.ts";
import { initialQuestionsActionState } from "./state.ts";
import { createEmptyQuestionEditorValue, toEditorValue } from "./types.ts";

type QuestionsManagementClientProps = {
	questions: QuestionDefinition[];
	saveAction: (
		state: QuestionsActionState,
		formData: FormData,
	) => Promise<QuestionsActionState>;
	deleteAction: (
		state: QuestionsActionState,
		formData: FormData,
	) => Promise<QuestionsActionState>;
	reorderAction: (
		updates: Array<{ id: string; position: number }>,
	) => Promise<void>;
};

export default function QuestionsManagementClient({
	questions,
	saveAction,
	deleteAction,
	reorderAction,
}: QuestionsManagementClientProps): ReactElement {
	const router = useRouter();
	const [mode, setMode] = useState<"view" | "create" | "edit">("view");
	const [selectedQuestionId, setSelectedQuestionId] = useState<
		string | undefined
	>(questions[0]?.id);

	const [saveState, saveFormAction] = useActionState(
		saveAction,
		initialQuestionsActionState,
	);

	const selectedDefinition = useMemo(
		() => questions.find((definition) => definition.id === selectedQuestionId),
		[questions, selectedQuestionId],
	);

	useEffect(() => {
		if (selectedQuestionId == null && questions.length > 0) {
			setSelectedQuestionId(questions[0]?.id);
		}
	}, [questions, selectedQuestionId]);

	useEffect(() => {
		if (saveState.status === "success") {
			router.refresh();
			setMode("view");
		}
	}, [router, saveState.status]);

	return (
		<Container component="main" maxWidth="xl" sx={{ py: 5 }}>
			<Stack spacing={3}>
				<Stack spacing={2}>
					<Typography component="h1" variant="h3" sx={{ mb: 1 }}>
						Questions Management
					</Typography>
					<Typography color="text.secondary">
						Inspect, add, edit, and delete questions with rubric definitions.
					</Typography>
				</Stack>

				<Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
					<Box sx={{ flex: "1 1 0" }}>
						<QuestionTable
							onReorder={reorderAction}
							questions={questions}
							selectedQuestionId={selectedQuestionId}
							onSelectQuestion={(questionId) => {
								setSelectedQuestionId(questionId);
								setMode("view");
							}}
							onCreate={() => setMode("create")}
						/>
					</Box>

					<Box sx={{ flex: "1 1 0" }}>
						{mode === "create" || mode === "edit" ? (
							<QuestionForm
								mode={mode}
								originalQuestionId={
									mode === "edit" ? selectedDefinition?.id : undefined
								}
								initialValue={
									mode === "edit" && selectedDefinition != null
										? toEditorValue(selectedDefinition)
										: createEmptyQuestionEditorValue()
								}
								action={saveFormAction}
								actionState={saveState}
								onCancel={() => setMode("view")}
							/>
						) : (
							<SelectedQuestionPane
								definition={selectedDefinition}
								deleteAction={deleteAction}
								onEdit={() => setMode("edit")}
								onDeleteSuccess={() => {
									router.refresh();
									setSelectedQuestionId(undefined);
									setMode("view");
								}}
							/>
						)}
					</Box>
				</Stack>
			</Stack>
		</Container>
	);
}
