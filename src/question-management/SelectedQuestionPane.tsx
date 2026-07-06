"use client";

import {
	Alert,
	Badge,
	Button,
	Divider,
	Group,
	Stack,
	Table,
	Text,
	Title,
} from "@mantine/core";
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
		<Stack gap="md">
			<Group>
				<Title order={2} flex={1}>
					Selected Question
				</Title>
				<Button
					variant="outline"
					disabled={definition == null}
					onClick={onEdit}
				>
					Edit
				</Button>
				<Button
					variant="outline"
					color="red"
					disabled={definition == null}
					onClick={() => setDeleteOpen(true)}
				>
					Delete
				</Button>
			</Group>

			{definition == null ? (
				<Alert color="blue" variant="light">
					Select a question to inspect details.
				</Alert>
			) : (
				<Stack gap="xs">
					<Text fw={600}>{definition.question.label ?? definition.id}</Text>
					<Text c="dimmed" size="sm">
						id: {definition.id}
					</Text>
					<Group gap="xs">
						<Badge variant="default">
							{definition.question.rubrics.length} rubrics
						</Badge>
						<Badge variant="default">
							{definition.assessmentCount} linked assessments
						</Badge>
					</Group>

					{definition.question.rubrics.length > 0 && (
						<>
							<Divider />
							<Table withTableBorder withColumnBorders fz="sm">
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Rubric</Table.Th>
										<Table.Th>Type</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{definition.question.rubrics.map((rubric) => (
										<Table.Tr key={rubric.id}>
											<Table.Td>{rubric.label ?? rubric.id}</Table.Td>
											<Table.Td>{rubric.type}</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</>
					)}
				</Stack>
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
