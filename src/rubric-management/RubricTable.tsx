"use client";

import {
	closestCenter,
	DndContext,
	type DragCancelEvent,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import {
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Badge,
	Box,
	Button,
	Group,
	Paper,
	Stack,
	Text,
	TextInput,
	UnstyledButton,
} from "@mantine/core";
import { IconGripVertical } from "@tabler/icons-react";
import {
	memo,
	type ReactElement,
	useEffect,
	useId,
	useMemo,
	useState,
	useTransition,
} from "react";
import type { RubricDefinition } from "./types.ts";

type RubricTableProps = {
	rubrics: RubricDefinition[];
	selectedRubricId?: string | undefined;
	onSelectRubric: (rubricId: string) => void;
	onCreate: () => void;
	onReorder: (
		updates: Array<{ id: string; position: number }>,
	) => Promise<void>;
};

function getRubricLabel(definition: RubricDefinition): string {
	return definition.rubric.label?.trim() || definition.id;
}

type DraggableRubricItemProps = {
	definition: RubricDefinition;
	isSelected: boolean;
	isDragInProgress: boolean;
	onSelectRubric: (rubricId: string) => void;
};

const DraggableRubricItem = memo(function DraggableRubricItemRow({
	definition,
	isSelected,
	onSelectRubric,
}: DraggableRubricItemProps): ReactElement {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: definition.id });

	return (
		<Group
			ref={setNodeRef}
			wrap="nowrap"
			gap="xs"
			p="xs"
			{...(isSelected && { bg: "blue.0" })}
			style={{ transform: CSS.Transform.toString(transform), transition }}
		>
			<Box
				{...listeners}
				{...attributes}
				display="inline-flex"
				c="dimmed"
				style={{ cursor: isDragging ? "grabbing" : "grab" }}
			>
				<IconGripVertical size={16} />
			</Box>

			<UnstyledButton flex={1} onClick={() => onSelectRubric(definition.id)}>
				<Text size="sm" fw={500}>
					{getRubricLabel(definition)}
				</Text>
				<Text size="xs" c="dimmed">
					id: {definition.id}
				</Text>
			</UnstyledButton>

			<Group gap="xs" wrap="nowrap">
				<Badge size="sm" variant="default">
					{definition.rubric.criteria.length} criteria
				</Badge>
				<Badge size="sm" variant="default">
					{definition.assessmentCount} assessments
				</Badge>
			</Group>
		</Group>
	);
});

export default function RubricTable({
	rubrics,
	selectedRubricId,
	onSelectRubric,
	onCreate,
	onReorder,
}: RubricTableProps): ReactElement {
	const [filter, setFilter] = useState("");
	const [orderedRubrics, setOrderedRubrics] =
		useState<RubricDefinition[]>(rubrics);
	const [reorderError, setReorderError] = useState<string | null>(null);
	const [isDragInProgress, setIsDragInProgress] = useState(false);
	const [isPending, startTransition] = useTransition();
	const dndContextId = useId();

	useEffect(() => {
		setOrderedRubrics(rubrics);
	}, [rubrics]);

	const filtered = useMemo(() => {
		const query = filter.trim().toLocaleLowerCase();
		if (query.length === 0) {
			return orderedRubrics;
		}

		return orderedRubrics.filter((definition) => {
			const haystack =
				`${definition.id} ${definition.rubric.label ?? ""}`.toLocaleLowerCase();
			return haystack.includes(query);
		});
	}, [filter, orderedRubrics]);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over == null || active.id === over.id) {
			return;
		}

		const activeIndex = filtered.findIndex((q) => q.id === active.id);
		const overIndex = filtered.findIndex((q) => q.id === over.id);

		if (activeIndex === -1 || overIndex === -1) {
			return;
		}

		const reordered = Array.from(filtered);
		const moved = reordered[activeIndex];
		if (!moved) return;

		reordered.splice(activeIndex, 1);
		reordered.splice(overIndex, 0, moved);

		const filteredIds = new Set(filtered.map((q) => q.id));
		const reorderedAll: RubricDefinition[] = [];
		let filteredCursor = 0;

		// Keep non-filtered items in their relative order and reorder only the visible subset.
		for (const rubric of orderedRubrics) {
			if (!filteredIds.has(rubric.id)) {
				reorderedAll.push(rubric);
				continue;
			}

			const reorderedRubric = reordered[filteredCursor];
			if (reorderedRubric != null) {
				reorderedAll.push(reorderedRubric);
			}
			filteredCursor += 1;
		}

		const previousOrder = orderedRubrics;
		setOrderedRubrics(reorderedAll);
		setReorderError(null);

		// Persist a complete, contiguous position map to avoid collisions.
		const updates = reorderedAll.map((q, idx) => ({ id: q.id, position: idx }));

		startTransition(() => {
			void onReorder(updates).catch(() => {
				setOrderedRubrics(previousOrder);
				setReorderError("Could not save new rubric order. Reverted changes.");
			});
		});
	};

	const handleDragStart = (_event: DragStartEvent) => {
		setIsDragInProgress(true);
	};

	const handleDragCancel = (_event: DragCancelEvent) => {
		setIsDragInProgress(false);
	};

	const handleDragEndWithStateReset = (event: DragEndEvent) => {
		setIsDragInProgress(false);
		handleDragEnd(event);
	};

	return (
		<Stack gap="md">
			<Group>
				<Button onClick={onCreate} disabled={isPending}>
					Add rubric
				</Button>
			</Group>

			<TextInput
				label="Filter rubrics"
				value={filter}
				onChange={(event) => setFilter(event.currentTarget.value)}
				size="sm"
				disabled={isPending}
			/>

			{reorderError ? (
				<Text c="red" size="sm">
					{reorderError}
				</Text>
			) : null}

			<DndContext
				id={dndContextId}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragCancel={handleDragCancel}
				onDragEnd={handleDragEndWithStateReset}
			>
				<Paper withBorder p={0} aria-label="Managed rubrics">
					{filtered.length === 0 ? (
						<Text c="dimmed" p="md">
							No rubrics match your filter.
						</Text>
					) : (
						<SortableContext
							items={filtered.map((q) => q.id)}
							strategy={verticalListSortingStrategy}
						>
							<Stack gap={0}>
								{filtered.map((definition) => (
									<DraggableRubricItem
										key={definition.id}
										definition={definition}
										isSelected={definition.id === selectedRubricId}
										isDragInProgress={isDragInProgress}
										onSelectRubric={onSelectRubric}
									/>
								))}
							</Stack>
						</SortableContext>
					)}
				</Paper>
			</DndContext>
		</Stack>
	);
}
