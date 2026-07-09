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
import type { QuestionDefinition } from "./types.ts";

type QuestionTableProps = {
	questions: QuestionDefinition[];
	selectedQuestionId?: string | undefined;
	onSelectQuestion: (questionId: string) => void;
	onCreate: () => void;
	onReorder: (
		updates: Array<{ id: string; position: number }>,
	) => Promise<void>;
};

function getQuestionLabel(definition: QuestionDefinition): string {
	return definition.question.label?.trim() || definition.id;
}

type DraggableQuestionItemProps = {
	definition: QuestionDefinition;
	isSelected: boolean;
	isDragInProgress: boolean;
	onSelectQuestion: (questionId: string) => void;
};

const DraggableQuestionItem = memo(function DraggableQuestionItemRow({
	definition,
	isSelected,
	onSelectQuestion,
}: DraggableQuestionItemProps): ReactElement {
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

			<UnstyledButton flex={1} onClick={() => onSelectQuestion(definition.id)}>
				<Text size="sm" fw={500}>
					{getQuestionLabel(definition)}
				</Text>
				<Text size="xs" c="dimmed">
					id: {definition.id}
				</Text>
			</UnstyledButton>

			<Group gap="xs" wrap="nowrap">
				<Badge size="sm" variant="default">
					{definition.question.criteria.length} criteria
				</Badge>
				<Badge size="sm" variant="default">
					{definition.assessmentCount} assessments
				</Badge>
			</Group>
		</Group>
	);
});

export default function QuestionTable({
	questions,
	selectedQuestionId,
	onSelectQuestion,
	onCreate,
	onReorder,
}: QuestionTableProps): ReactElement {
	const [filter, setFilter] = useState("");
	const [orderedQuestions, setOrderedQuestions] =
		useState<QuestionDefinition[]>(questions);
	const [reorderError, setReorderError] = useState<string | null>(null);
	const [isDragInProgress, setIsDragInProgress] = useState(false);
	const [isPending, startTransition] = useTransition();
	const dndContextId = useId();

	useEffect(() => {
		setOrderedQuestions(questions);
	}, [questions]);

	const filtered = useMemo(() => {
		const query = filter.trim().toLocaleLowerCase();
		if (query.length === 0) {
			return orderedQuestions;
		}

		return orderedQuestions.filter((definition) => {
			const haystack =
				`${definition.id} ${definition.question.label ?? ""}`.toLocaleLowerCase();
			return haystack.includes(query);
		});
	}, [filter, orderedQuestions]);

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
		const reorderedAll: QuestionDefinition[] = [];
		let filteredCursor = 0;

		// Keep non-filtered items in their relative order and reorder only the visible subset.
		for (const question of orderedQuestions) {
			if (!filteredIds.has(question.id)) {
				reorderedAll.push(question);
				continue;
			}

			const reorderedQuestion = reordered[filteredCursor];
			if (reorderedQuestion != null) {
				reorderedAll.push(reorderedQuestion);
			}
			filteredCursor += 1;
		}

		const previousOrder = orderedQuestions;
		setOrderedQuestions(reorderedAll);
		setReorderError(null);

		// Persist a complete, contiguous position map to avoid collisions.
		const updates = reorderedAll.map((q, idx) => ({ id: q.id, position: idx }));

		startTransition(() => {
			void onReorder(updates).catch(() => {
				setOrderedQuestions(previousOrder);
				setReorderError("Could not save new question order. Reverted changes.");
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
					Add question
				</Button>
			</Group>

			<TextInput
				label="Filter questions"
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
				<Paper withBorder p={0} aria-label="Managed questions">
					{filtered.length === 0 ? (
						<Text c="dimmed" p="md">
							No questions match your filter.
						</Text>
					) : (
						<SortableContext
							items={filtered.map((q) => q.id)}
							strategy={verticalListSortingStrategy}
						>
							<Stack gap={0}>
								{filtered.map((definition) => (
									<DraggableQuestionItem
										key={definition.id}
										definition={definition}
										isSelected={definition.id === selectedQuestionId}
										isDragInProgress={isDragInProgress}
										onSelectQuestion={onSelectQuestion}
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
