"use client";

import { Box, Container, Flex, Stack, Text, Title } from "@mantine/core";
import { useRouter } from "next/navigation";
import {
	type ReactElement,
	useActionState,
	useEffect,
	useMemo,
	useState,
} from "react";
import QuestionForm from "./QuestionForm.tsx";
import QuestionTable from "./QuestionTable.tsx";
import SelectedQuestionPane from "./SelectedQuestionPane.tsx";
import type { QuestionsActionState } from "./state.ts";
import { initialQuestionsActionState } from "./state.ts";
import type { QuestionDefinition } from "./types.ts";
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
		async (state: QuestionsActionState, formData: FormData) => {
			const result = await saveAction(state, formData);
			if (result.status === "success") {
				router.refresh();
				setMode("view");
			}
			return result;
		},
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

	const formKey =
		mode === "edit" ? `edit-${selectedDefinition?.id ?? "unknown"}` : "create";

	return (
		<Container component="main" size="xl" py="xl">
			<Stack gap="xl">
				<Stack gap="xs">
					<Title order={1}>Questions Management</Title>
					<Text c="dimmed">
						Inspect, add, edit, and delete questions with rubric definitions.
					</Text>
				</Stack>

				<Flex gap="xl" direction={{ base: "column", lg: "row" }}>
					<Box flex="1 1 0" miw={0}>
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

					<Box flex="1 1 0" miw={0}>
						{mode === "create" || mode === "edit" ? (
							<QuestionForm
								key={formKey}
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
				</Flex>
			</Stack>
		</Container>
	);
}
