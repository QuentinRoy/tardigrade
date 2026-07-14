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
import DeleteRubricDialog from "./DeleteRubricDialog.tsx";
import type { RubricsActionState } from "./state.ts";
import { initialRubricsActionState } from "./state.ts";
import type { RubricDefinition } from "./types.ts";

type SelectedRubricPaneProps = {
	definition?: RubricDefinition | undefined;
	deleteAction: (
		state: RubricsActionState,
		formData: FormData,
	) => Promise<RubricsActionState>;
	onEdit: () => void;
	onDeleteSuccess: () => void;
};

export default function SelectedRubricPane({
	definition,
	deleteAction,
	onEdit,
	onDeleteSuccess,
}: SelectedRubricPaneProps): ReactElement {
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [deleteState, deleteFormAction] = useActionState(
		async (state: RubricsActionState, formData: FormData) => {
			const result = await deleteAction(state, formData);
			if (result.status === "success") {
				setDeleteOpen(false);
				onDeleteSuccess();
			}
			return result;
		},
		initialRubricsActionState,
	);

	return (
		<Stack gap="md">
			<Group>
				<Title order={2} flex={1}>
					Selected Rubric
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
					Select a rubric to inspect details.
				</Alert>
			) : (
				<Stack gap="xs">
					<Text fw={600}>{definition.rubric.label ?? definition.id}</Text>
					<Text c="dimmed" size="sm">
						id: {definition.id}
					</Text>
					<Group gap="xs">
						<Badge variant="default">
							{definition.rubric.criteria.length} criteria
						</Badge>
						<Badge variant="default">
							{definition.gradedTargetCount} linked grades
						</Badge>
					</Group>

					{definition.rubric.criteria.length > 0 && (
						<>
							<Divider />
							<Table withTableBorder withColumnBorders fz="sm">
								<Table.Thead>
									<Table.Tr>
										<Table.Th>Criterion</Table.Th>
										<Table.Th>Kind</Table.Th>
									</Table.Tr>
								</Table.Thead>
								<Table.Tbody>
									{definition.rubric.criteria.map((criterion) => (
										<Table.Tr key={criterion.id}>
											<Table.Td>{criterion.label ?? criterion.id}</Table.Td>
											<Table.Td>{criterion.kind}</Table.Td>
										</Table.Tr>
									))}
								</Table.Tbody>
							</Table>
						</>
					)}
				</Stack>
			)}

			<DeleteRubricDialog
				open={deleteOpen}
				definition={definition}
				action={deleteFormAction}
				actionState={deleteState}
				onClose={() => setDeleteOpen(false)}
			/>
		</Stack>
	);
}
