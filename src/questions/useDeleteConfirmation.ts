"use client";

export function buildDeleteConfirmationPhrase(
  questionId: string,
  assessmentCount: number,
): string {
  return `delete ${questionId} (${assessmentCount} assessments)`;
}

export function matchesDeleteConfirmation(
  actual: string,
  expected: string,
): boolean {
  return (
    actual.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase()
  );
}
