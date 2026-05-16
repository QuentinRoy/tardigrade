"use client";

import { Container } from "@mui/material";
import { useRouter } from "next/navigation";
import { type ReactElement, useActionState } from "react";
import type { Question } from "@/db/types";
import { editQuestionAction } from "./actions";
import QuestionForm from "./QuestionForm";
import { initialQuestionsActionState } from "./state";
import { toEditorValue } from "./types";

type EditQuestionClientProps = {
  questionId: string;
  question: Question;
};

export default function EditQuestionClient({
  questionId,
  question,
}: EditQuestionClientProps): ReactElement {
  const router = useRouter();
  const [saveState, saveFormAction] = useActionState(
    editQuestionAction,
    initialQuestionsActionState,
  );

  const initialValue = toEditorValue({
    id: questionId,
    label: question.label,
    position: 0,
    assessmentCount: 0,
    rubricCount: question.rubrics.length,
    question,
  });

  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <QuestionForm
        mode="edit"
        originalQuestionId={questionId}
        initialValue={initialValue}
        action={saveFormAction}
        actionState={saveState}
        onCancel={() => router.push("/questions")}
      />
    </Container>
  );
}
