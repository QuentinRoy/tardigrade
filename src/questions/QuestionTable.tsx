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
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import {
	Box,
	Button,
	Chip,
	List,
	ListItem,
	ListItemButton,
	ListItemText,
	Stack,
	TextField,
	Typography,
} from "@mui/material";
import {
	memo,
	type ReactElement,
	useEffect,
	useId,
	useMemo,
	useState,
	useTransition,
} from "react";
import type { QuestionDefinition } from "#db/types.ts";

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

const DraggableQuestionItem = memo(function DraggableQuestionItem({
	definition,
	isSelected,
	isDragInProgress,
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

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: 1,
	};

	return (
		<ListItem
			ref={setNodeRef}
			style={style}
			disablePadding
			sx={{
				backgroundColor: isSelected ? "action.selected" : "transparent",
				"&:hover": {
					backgroundColor: isDragInProgress
						? "transparent"
						: isSelected
							? "action.selected"
							: "action.hover",
				},
			}}
			secondaryAction={
				<Stack direction="row" spacing={1}>
					<Chip
						size="small"
						label={`${definition.question.rubrics.length} rubrics`}
					/>
					<Chip
						size="small"
						label={`${definition.assessmentCount} assessments`}
					/>
				</Stack>
			}
		>
			<Box
				{...listeners}
				{...attributes}
				sx={{
					display: "flex",
					alignItems: "center",
					cursor: isDragging ? "grabbing" : "grab",
					px: 0.5,
					py: 0.5,
					mr: 0.25,
				}}
			>
				<DragIndicatorIcon sx={{ color: "action.disabled" }} />
			</Box>
			<ListItemButton
				selected={false}
				onClick={() => onSelectQuestion(definition.id)}
				sx={{
					flex: 1,
					backgroundColor: "transparent",
					"&:hover": { backgroundColor: "transparent" },
				}}
			>
				<ListItemText
					primary={getQuestionLabel(definition)}
					secondary={`id: ${definition.id}`}
				/>
			</ListItemButton>
		</ListItem>
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

		// Reorder within the filtered list
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
		<Stack spacing={2}>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button variant="contained" onClick={onCreate} disabled={isPending}>
					Add question
				</Button>
			</Stack>

			<TextField
				label="Filter questions"
				value={filter}
				onChange={(event) => setFilter(event.target.value)}
				size="small"
				disabled={isPending}
			/>

			{reorderError ? (
				<Typography color="error">{reorderError}</Typography>
			) : null}

			<DndContext
				id={dndContextId}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragCancel={handleDragCancel}
				onDragEnd={handleDragEndWithStateReset}
			>
				<List
					aria-label="Managed questions"
					sx={{ border: 1, borderColor: "divider", borderRadius: 1 }}
				>
					{filtered.length === 0 ? (
						<Box sx={{ p: 2 }}>
							<Typography color="text.secondary">
								No questions match your filter.
							</Typography>
						</Box>
					) : (
						<SortableContext
							items={filtered.map((q) => q.id)}
							strategy={verticalListSortingStrategy}
						>
							{filtered.map((definition) => {
								const isSelected = definition.id === selectedQuestionId;
								return (
									<DraggableQuestionItem
										key={definition.id}
										definition={definition}
										isSelected={isSelected}
										isDragInProgress={isDragInProgress}
										onSelectQuestion={onSelectQuestion}
									/>
								);
							})}
						</SortableContext>
					)}
				</List>
			</DndContext>
		</Stack>
	);
}
