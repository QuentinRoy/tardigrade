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
import RubricForm from "./RubricForm.tsx";
import RubricTable from "./RubricTable.tsx";
import SelectedRubricPane from "./SelectedRubricPane.tsx";
import type { RubricsActionState } from "./state.ts";
import { initialRubricsActionState } from "./state.ts";
import type { RubricDefinition } from "./types.ts";
import { createEmptyRubricEditorValue, toEditorValue } from "./types.ts";

type RubricsManagementClientProps = {
	rubrics: RubricDefinition[];
	saveAction: (
		state: RubricsActionState,
		formData: FormData,
	) => Promise<RubricsActionState>;
	deleteAction: (
		state: RubricsActionState,
		formData: FormData,
	) => Promise<RubricsActionState>;
	reorderAction: (
		updates: Array<{ id: string; position: number }>,
	) => Promise<void>;
};

export default function RubricsManagementClient({
	rubrics,
	saveAction,
	deleteAction,
	reorderAction,
}: RubricsManagementClientProps): ReactElement {
	const router = useRouter();
	const [mode, setMode] = useState<"view" | "create" | "edit">("view");
	const [selectedRubricId, setSelectedRubricId] = useState<string | undefined>(
		rubrics[0]?.id,
	);

	const [saveState, saveFormAction] = useActionState(
		async (state: RubricsActionState, formData: FormData) => {
			const result = await saveAction(state, formData);
			if (result.status === "success") {
				router.refresh();
				setMode("view");
			}
			return result;
		},
		initialRubricsActionState,
	);

	const selectedDefinition = useMemo(
		() => rubrics.find((definition) => definition.id === selectedRubricId),
		[rubrics, selectedRubricId],
	);

	useEffect(() => {
		if (selectedRubricId == null && rubrics.length > 0) {
			setSelectedRubricId(rubrics[0]?.id);
		}
	}, [rubrics, selectedRubricId]);

	const formKey =
		mode === "edit" ? `edit-${selectedDefinition?.id ?? "unknown"}` : "create";

	return (
		<Container component="main" size="xl" py="xl">
			<Stack gap="xl">
				<Stack gap="xs">
					<Title order={1}>Rubrics Management</Title>
					<Text c="dimmed">
						Inspect, add, edit, and delete rubrics with criterion definitions.
					</Text>
				</Stack>

				<Flex gap="xl" direction={{ base: "column", lg: "row" }}>
					<Box flex="1 1 0" miw={0}>
						<RubricTable
							onReorder={reorderAction}
							rubrics={rubrics}
							selectedRubricId={selectedRubricId}
							onSelectRubric={(rubricId) => {
								setSelectedRubricId(rubricId);
								setMode("view");
							}}
							onCreate={() => setMode("create")}
						/>
					</Box>

					<Box flex="1 1 0" miw={0}>
						{mode === "create" || mode === "edit" ? (
							<RubricForm
								key={formKey}
								mode={mode}
								originalRubricId={
									mode === "edit" ? selectedDefinition?.id : undefined
								}
								initialValue={
									mode === "edit" && selectedDefinition != null
										? toEditorValue(selectedDefinition)
										: createEmptyRubricEditorValue()
								}
								action={saveFormAction}
								actionState={saveState}
								onCancel={() => setMode("view")}
							/>
						) : (
							<SelectedRubricPane
								definition={selectedDefinition}
								deleteAction={deleteAction}
								onEdit={() => setMode("edit")}
								onDeleteSuccess={() => {
									router.refresh();
									setSelectedRubricId(undefined);
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
