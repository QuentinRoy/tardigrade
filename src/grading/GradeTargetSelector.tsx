"use client";

import {
	Badge,
	Combobox,
	Group,
	Loader,
	Modal,
	Stack,
	Text,
	TextInput,
	useCombobox,
} from "@mantine/core";
import {
	type ReactElement,
	Suspense,
	use,
	useEffect,
	useId,
	useMemo,
	useState,
} from "react";
import type { GradeTarget } from "#grade-targets/types.ts";
import {
	buildGradeTargetSearchTargets,
	createGradeTargetSearch,
	type GradeTargetSearchResult,
} from "./quickJumpSearch.ts";

type CompletionByTargetId = Record<
	string,
	{ completed: number; total: number }
>;

type GradeTargetSelectorProps = {
	open: boolean;
	onClose: () => void;
	onSelectTarget: (targetId: string) => void;
	targets: GradeTarget[];
	completionPromise: Promise<CompletionByTargetId>;
	progressLabel: string;
};

// The dialog is opened on demand, so the project-wide completion it needs is
// passed down as a promise (not awaited by the page) and only resolved here,
// once opened, under Suspense — looking up or saving a grade target never
// waits on this dialog's data (Finding 19).
export default function GradeTargetSelector({
	open,
	onClose,
	onSelectTarget,
	targets,
	completionPromise,
	progressLabel,
}: GradeTargetSelectorProps): ReactElement | null {
	if (!open) {
		return null;
	}

	return (
		<Modal
			opened
			onClose={onClose}
			title="Find student or group"
			fullScreen
			closeButtonProps={{ "aria-label": "Close lookup" }}
		>
			<GradeTargetSelectorContent
				onClose={onClose}
				onSelectTarget={onSelectTarget}
				targets={targets}
				completionPromise={completionPromise}
				progressLabel={progressLabel}
			/>
		</Modal>
	);
}

function GradeTargetSelectorContent({
	onClose,
	onSelectTarget,
	targets,
	completionPromise,
	progressLabel,
}: {
	onClose: () => void;
	onSelectTarget: (targetId: string) => void;
	targets: GradeTarget[];
	completionPromise: Promise<CompletionByTargetId>;
	progressLabel: string;
}): ReactElement {
	const [query, setQuery] = useState("");
	const searchInputId = useId();
	// Combobox.EventsTarget owns the Escape key (it stops the event from
	// reaching Modal's own Escape-to-close listener), so closing the dropdown
	// is wired to close the whole selector instead.
	const combobox = useCombobox({
		defaultOpened: true,
		onDropdownClose: onClose,
	});

	const handleSubmit = (targetId: string) => {
		onSelectTarget(targetId);
		onClose();
	};

	return (
		<Combobox store={combobox} onOptionSubmit={handleSubmit}>
			<Stack gap="md">
				<Combobox.EventsTarget>
					<TextInput
						id={searchInputId}
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search by group or student name"
						data-autofocus
					/>
				</Combobox.EventsTarget>

				<Combobox.Options>
					<Suspense fallback={<Loader m="auto" />}>
						<GradeTargetResultsList
							query={query}
							targets={targets}
							completionPromise={completionPromise}
							progressLabel={progressLabel}
							combobox={combobox}
						/>
					</Suspense>
				</Combobox.Options>
			</Stack>
		</Combobox>
	);
}

function GradeTargetResultsList({
	query,
	targets,
	completionPromise,
	progressLabel,
	combobox,
}: {
	query: string;
	targets: GradeTarget[];
	completionPromise: Promise<CompletionByTargetId>;
	progressLabel: string;
	combobox: ReturnType<typeof useCombobox>;
}): ReactElement {
	const completionByTargetId = use(completionPromise);

	const searchTargets = useMemo(
		() => buildGradeTargetSearchTargets(targets, completionByTargetId),
		[targets, completionByTargetId],
	);

	const search = useMemo(
		() => createGradeTargetSearch(searchTargets),
		[searchTargets],
	);

	const results = useMemo(() => search(query), [search, query]);

	// Keep the top result highlighted as the query (and so the result set)
	// changes, mirroring how a search-driven list is expected to behave.
	useEffect(() => {
		if (results.length > 0) {
			combobox.selectFirstOption();
		}
	}, [results, combobox]);

	if (results.length === 0) {
		return (
			<Combobox.Empty>
				{query.length === 0
					? "Type to search by group or student name (supports partial matches)"
					: "No matching students or groups found. Try a different search term."}
			</Combobox.Empty>
		);
	}

	return (
		<Stack gap="xs">
			{results.map((result) => (
				<GradeTargetOption
					key={result.targetId}
					result={result}
					progressLabel={progressLabel}
				/>
			))}
		</Stack>
	);
}

function GradeTargetOption({
	result,
	progressLabel,
}: {
	result: GradeTargetSearchResult;
	progressLabel: string;
}): ReactElement {
	const secondaryText =
		result.matchReason.length > 0
			? result.matchReason
			: result.memberNames.join(", ");

	return (
		<Combobox.Option value={result.targetId}>
			<Group justify="space-between" wrap="nowrap" gap="sm">
				<div>
					<Text size="sm">{result.displayLabel}</Text>
					{secondaryText.length > 0 ? (
						<Text size="xs" opacity={0.7}>
							{secondaryText}
						</Text>
					) : null}
				</div>
				<Badge color={result.isCompleted ? "green" : "gray"} variant="light">
					{result.completion.completed} / {result.completion.total}{" "}
					{progressLabel}
				</Badge>
			</Group>
		</Combobox.Option>
	);
}
