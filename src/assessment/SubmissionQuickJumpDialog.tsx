"use client";

import CloseIcon from "@mui/icons-material/Close";
import Chip from "@mui/material/Chip";
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
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Submission } from "@/db/types";
import {
  buildSubmissionSearchTargets,
  createSubmissionSearch,
} from "@/submissions/quickJumpSearch";

type SubmissionQuickJumpDialogProps = {
  open: boolean;
  onClose: () => void;
  onSelectSubmission: (submissionId: string) => void;
  submissions: Submission[];
  progressBySubmissionId: Record<string, { completed: number; total: number }>;
  progressLabel: string;
};

export default function SubmissionQuickJumpDialog({
  open,
  onClose,
  onSelectSubmission,
  submissions,
  progressBySubmissionId,
  progressLabel,
}: SubmissionQuickJumpDialogProps): ReactElement {
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

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlightedIndex(0);

      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
    }
  }, [open]);

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
    <Dialog open={open} onClose={onClose} fullScreen>
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
                    "&:hover": {
                      backgroundColor: "action.hover",
                    },
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
      </DialogContent>
    </Dialog>
  );
}
