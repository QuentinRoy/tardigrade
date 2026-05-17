"use client";

import { Box, Container, Stack, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import {
  type ReactElement,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import { reorderQuestionsAction, saveQuestionAction } from "./actions";
import QuestionForm from "./QuestionForm";
import QuestionTable from "./QuestionTable";
import SelectedQuestionPane from "./SelectedQuestionPane";
import { initialQuestionsActionState } from "./state";
import {
  createEmptyQuestionEditorValue,
  type QuestionManagementItem,
} from "./types";

type QuestionsManagementClientProps = {
  questions: QuestionManagementItem[];
};

export default function QuestionsManagementClient({
  questions,
}: QuestionsManagementClientProps): ReactElement {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "create">("view");
  const [selectedQuestionId, setSelectedQuestionId] = useState<
    string | undefined
  >(questions[0]?.id);

  const [saveState, saveFormAction] = useActionState(
    saveQuestionAction,
    initialQuestionsActionState,
  );

  const selectedQuestion = useMemo(
    () => questions.find((question) => question.id === selectedQuestionId),
    [questions, selectedQuestionId],
  );

  useEffect(() => {
    if (selectedQuestionId == null && questions.length > 0) {
      setSelectedQuestionId(questions[0]?.id);
    }
  }, [questions, selectedQuestionId]);

  useEffect(() => {
    if (saveState.status === "success") {
      router.refresh();
      setMode("view");
    }
  }, [router, saveState.status]);

  return (
    <Container component="main" maxWidth="xl" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Stack spacing={2}>
          <Typography component="h1" variant="h3" sx={{ mb: 1 }}>
            Questions Management
          </Typography>
          <Typography color="text.secondary">
            Inspect, add, edit, and delete questions with rubric definitions.
          </Typography>
        </Stack>

        <Stack direction={{ xs: "column", lg: "row" }} spacing={3}>
          <Box sx={{ flex: "1 1 0" }}>
            <QuestionTable
              onReorder={reorderQuestionsAction}
              questions={questions}
              selectedQuestionId={selectedQuestionId}
              onSelectQuestion={(questionId) => {
                setSelectedQuestionId(questionId);
                setMode("view");
              }}
              onCreate={() => setMode("create")}
            />
          </Box>

          <Box sx={{ flex: "1 1 0" }}>
            {mode === "create" ? (
              <QuestionForm
                mode="create"
                initialValue={createEmptyQuestionEditorValue()}
                action={saveFormAction}
                actionState={saveState}
                onCancel={() => setMode("view")}
              />
            ) : (
              <SelectedQuestionPane
                question={selectedQuestion}
                onDeleteSuccess={() => {
                  router.refresh();
                  setSelectedQuestionId(undefined);
                }}
              />
            )}
          </Box>
        </Stack>
      </Stack>
    </Container>
  );
}
