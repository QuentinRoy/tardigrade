"use client";

import CloseIcon from "@mui/icons-material/Close";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
	type KeyboardEvent,
	type ReactElement,
	type ReactNode,
	Suspense,
	use,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import {
	buildSubmissionSearchTargets,
	createSubmissionSearch,
} from "#submissions/quickJumpSearch.ts";
import type { Submission } from "#submissions/types.ts";

type SubmissionProgressBySubmissionId = Record<
	string,
	{ completed: number; total: number }
>;

type SubmissionQuickJumpDialogProps = {
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
export default function SubmissionQuickJumpDialog({
	open,
	onClose,
	onSelectSubmission,
	submissions,
	progressPromise,
	progressLabel,
}: SubmissionQuickJumpDialogProps): ReactElement | null {
	if (!open) {
		return null;
	}

	return (
		<Suspense
			fallback={
				<QuickJumpDialogShell onClose={onClose}>
					<CircularProgress sx={{ alignSelf: "center", my: 4 }} />
				</QuickJumpDialogShell>
			}
		>
			<SubmissionQuickJumpDialogContent
				onClose={onClose}
				onSelectSubmission={onSelectSubmission}
				submissions={submissions}
				progressPromise={progressPromise}
				progressLabel={progressLabel}
			/>
		</Suspense>
	);
}

function QuickJumpDialogShell({
	onClose,
	children,
}: {
	onClose: () => void;
	children: ReactNode;
}): ReactElement {
	return (
		<Dialog open onClose={onClose} fullScreen>
			<DialogTitle>
				Find submission
				<IconButton
					aria-label="Close lookup"
					onClick={onClose}
					sx={{ position: "absolute", right: 8, top: 8 }}
				>
					<CloseIcon />
				</IconButton>
			</DialogTitle>
			<DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
				{children}
			</DialogContent>
		</Dialog>
	);
}

function SubmissionQuickJumpDialogContent({
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
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [query, setQuery] = useState("");
	const [highlightedIndex, setHighlightedIndex] = useState(0);

	const searchTargets = useMemo(
		() => buildSubmissionSearchTargets(submissions, progressBySubmissionId),
		[submissions, progressBySubmissionId],
	);

	const search = useMemo(
		() => createSubmissionSearch(searchTargets),
		[searchTargets],
	);

	const results = useMemo(() => search(query), [search, query]);

	// This component only mounts once the dialog is open, so this runs on open.
	useEffect(() => {
		setQuery("");
		setHighlightedIndex(0);

		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.select();
		});
	}, []);

	useEffect(() => {
		if (results.length === 0) {
			setHighlightedIndex(0);
			return;
		}

		if (highlightedIndex > results.length - 1) {
			setHighlightedIndex(results.length - 1);
		}
	}, [results, highlightedIndex]);

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			if (results.length === 0) {
				return;
			}
			setHighlightedIndex((previous) =>
				previous >= results.length - 1 ? results.length - 1 : previous + 1,
			);
			return;
		}

		if (event.key === "ArrowUp") {
			event.preventDefault();
			if (results.length === 0) {
				return;
			}
			setHighlightedIndex((previous) => (previous <= 0 ? 0 : previous - 1));
			return;
		}

		if (event.key === "Enter") {
			event.preventDefault();
			const selected = results[highlightedIndex];
			if (selected != null) {
				onSelectSubmission(selected.submissionId);
				onClose();
			}
			return;
		}

		if (event.key === "Escape") {
			event.preventDefault();
			onClose();
		}
	};

	return (
		<QuickJumpDialogShell onClose={onClose}>
			<TextField
				autoFocus
				inputRef={inputRef}
				placeholder="Search by team or student name"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				onKeyDown={handleKeyDown}
			/>

			{results.length === 0 && query.length === 0 ? (
				<Typography color="text.secondary" sx={{ my: 2 }}>
					Type to search by team or student name (supports partial matches)
				</Typography>
			) : results.length === 0 ? (
				<Typography color="text.secondary" sx={{ my: 2 }}>
					No matching submissions found. Try a different search term.
				</Typography>
			) : (
				<List sx={{ p: 0 }}>
					{results.map((result, index) => {
						const isHighlighted = index === highlightedIndex;
						const progressText = `${result.progress.completed} / ${result.progress.total} ${progressLabel}`;

						return (
							<ListItemButton
								key={result.submissionId}
								selected={isHighlighted}
								onClick={() => {
									onSelectSubmission(result.submissionId);
									onClose();
								}}
								sx={{
									mb: 1,
									borderRadius: 1,
									backgroundColor: isHighlighted ? "action.hover" : undefined,
									"&:hover": { backgroundColor: "action.hover" },
								}}
							>
								<ListItemText
									primary={result.displayLabel}
									secondary={
										result.matchReason ||
										(result.memberNames.length > 0
											? result.memberNames.join(", ")
											: undefined)
									}
								/>
								<Chip
									size="small"
									label={progressText}
									color={result.isCompleted ? "success" : "default"}
								/>
							</ListItemButton>
						);
					})}
				</List>
			)}
		</QuickJumpDialogShell>
	);
}
