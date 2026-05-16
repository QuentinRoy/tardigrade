"use client";

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
import { type ReactElement, useMemo, useState } from "react";
import type { QuestionManagementItem } from "./types";

type QuestionTableProps = {
  questions: QuestionManagementItem[];
  selectedQuestionId?: string;
  onSelectQuestion: (questionId: string) => void;
  onCreate: () => void;
};

function getQuestionLabel(question: QuestionManagementItem): string {
  return question.label?.trim() || question.id;
}

export default function QuestionTable({
  questions,
  selectedQuestionId,
  onSelectQuestion,
  onCreate,
}: QuestionTableProps): ReactElement {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const query = filter.trim().toLocaleLowerCase();
    if (query.length === 0) {
      return questions;
    }

    return questions.filter((question) => {
      const haystack =
        `${question.id} ${question.label ?? ""}`.toLocaleLowerCase();
      return haystack.includes(query);
    });
  }, [filter, questions]);

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
        <Button variant="contained" onClick={onCreate}>
          Add question
        </Button>
      </Stack>

      <TextField
        label="Filter questions"
        value={filter}
        onChange={(event) => setFilter(event.target.value)}
        size="small"
      />

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
          filtered.map((question) => {
            const isSelected = question.id === selectedQuestionId;
            return (
              <ListItem
                key={question.id}
                disablePadding
                secondaryAction={
                  <Stack direction="row" spacing={1}>
                    <Chip
                      size="small"
                      label={`${question.rubricCount} rubrics`}
                    />
                    <Chip
                      size="small"
                      label={`${question.assessmentCount} assessments`}
                    />
                  </Stack>
                }
              >
                <ListItemButton
                  selected={isSelected}
                  onClick={() => onSelectQuestion(question.id)}
                >
                  <ListItemText
                    primary={getQuestionLabel(question)}
                    secondary={`id: ${question.id}`}
                  />
                </ListItemButton>
              </ListItem>
            );
          })
        )}
      </List>
    </Stack>
  );
}
