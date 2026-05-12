"use client";

import React from "react";

export type SaveError = {
  id: string;
  questionId: string;
  submissionId: string;
  questionLabel?: string;
  submissionLabel?: string;
  message: string;
};

type SaveErrorsContextValue = {
  errors: SaveError[];
  addError: (error: Omit<SaveError, "id">) => void;
  dismissError: (id: string) => void;
};

const SaveErrorsContext = React.createContext<SaveErrorsContextValue | null>(
  null,
);

export function SaveErrorsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [errors, setErrors] = React.useState<SaveError[]>([]);

  const addError = React.useCallback((error: Omit<SaveError, "id">) => {
    const id = crypto.randomUUID();
    setErrors((prev) => [...prev, { ...error, id }]);
  }, []);

  const dismissError = React.useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  return (
    <SaveErrorsContext value={{ errors, addError, dismissError }}>
      {children}
    </SaveErrorsContext>
  );
}

export function useSaveErrors(): SaveErrorsContextValue {
  const ctx = React.useContext(SaveErrorsContext);
  if (ctx == null) {
    throw new Error("useSaveErrors must be used within SaveErrorsProvider");
  }
  return ctx;
}
