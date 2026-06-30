"use client";

import {
	Badge,
	Combobox,
	Group,
	Loader,
	Modal,
	Stack,
	Text,
	useCombobox,
} from "@mantine/core";
import {
	type ReactElement,
	type ReactNode,
	Suspense,
	use,
	useEffect,
	useMemo,
	useState,
} from "react";
import type { Submission } from "#submissions/types.ts";
import {
	buildSubmissionSearchTargets,
	createSubmissionSearch,
} from "./quickJumpSearch.ts";

type SubmissionProgressBySubmissionId = Record<
	string,
	{ completed: number; total: number }
>;

type SubmissionSelectorProps = {
	open: boolean;
	onClose: () => void;
	onSelectSubmission: (submissionId: string) => void;
	submissions: Submission[];
	progressPromise: Promise<SubmissionProgressBySubmissionId>;
	progressLabel: string;
};

// The dialog is opened on demand, so the project-wide progress it needs is
// passed down as a promise (not awaited by the page) and only resolved here,
// once opened, under Suspense — looking up or saving a submission never waits
// on this dialog's data (Finding 19).
export default function SubmissionSelector({
	open,
	onClose,
	onSelectSubmission,
	submissions,
	progressPromise,
	progressLabel,
}: SubmissionSelectorProps): ReactElement | null {
	if (!open) {
		return null;
	}

	return (
		<SelectorShell onClose={onClose}>
			<Suspense fallback={<Loader m="auto" />}>
				<SubmissionSelectorContent
					onClose={onClose}
					onSelectSubmission={onSelectSubmission}
					submissions={submissions}
					progressPromise={progressPromise}
					progressLabel={progressLabel}
				/>
			</Suspense>
		</SelectorShell>
	);
}

function SelectorShell({
	onClose,
	children,
}: {
	onClose: () => void;
	children: ReactNode;
}): ReactElement {
	return (
		<Modal
			opened
			onClose={onClose}
			title="Find submission"
			fullScreen
			closeButtonProps={{ "aria-label": "Close lookup" }}
		>
			{children}
		</Modal>
	);
}

function SubmissionSelectorContent({
	onClose,
	onSelectSubmission,
	submissions,
	progressPromise,
	progressLabel,
}: {
	onClose: () => void;
	onSelectSubmission: (submissionId: string) => void;
	submissions: Submission[];
	progressPromise: Promise<SubmissionProgressBySubmissionId>;
	progressLabel: string;
}): ReactElement {
	const progressBySubmissionId = use(progressPromise);
	const [query, setQuery] = useState("");
	// Combobox.EventsTarget owns the Escape key (it stops the event from
	// reaching Modal's own Escape-to-close listener), so closing the dropdown
	// is wired to close the whole selector instead.
	const combobox = useCombobox({
		defaultOpened: true,
		onDropdownClose: onClose,
	});

	const searchTargets = useMemo(
		() => buildSubmissionSearchTargets(submissions, progressBySubmissionId),
		[submissions, progressBySubmissionId],
	);

	const search = useMemo(
		() => createSubmissionSearch(searchTargets),
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

	const handleSubmit = (submissionId: string) => {
		onSelectSubmission(submissionId);
		onClose();
	};

	return (
		<Combobox store={combobox} onOptionSubmit={handleSubmit}>
			<Stack gap="md">
				<Combobox.EventsTarget>
					<Combobox.Search
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder="Search by team or student name"
						autoFocus
						style={{ width: "100%" }}
					/>
				</Combobox.EventsTarget>

				<Combobox.Options>
					{results.length === 0 ? (
						<Combobox.Empty>
							{query.length === 0
								? "Type to search by team or student name (supports partial matches)"
								: "No matching submissions found. Try a different search term."}
						</Combobox.Empty>
					) : (
						<Stack gap="xs">
							{results.map((result) => {
								const secondaryText =
									result.matchReason.length > 0
										? result.matchReason
										: result.memberNames.join(", ");

								return (
									<Combobox.Option
										value={result.submissionId}
										key={result.submissionId}
									>
										<Group justify="space-between" wrap="nowrap" gap="sm">
											<div>
												<Text size="sm">{result.displayLabel}</Text>
												{secondaryText.length > 0 ? (
													<Text size="xs" style={{ opacity: 0.7 }}>
														{secondaryText}
													</Text>
												) : null}
											</div>
											<Badge
												color={result.isCompleted ? "green" : "gray"}
												variant="light"
											>
												{result.progress.completed} / {result.progress.total}{" "}
												{progressLabel}
											</Badge>
										</Group>
									</Combobox.Option>
								);
							})}
						</Stack>
					)}
				</Combobox.Options>
			</Stack>
		</Combobox>
	);
}
