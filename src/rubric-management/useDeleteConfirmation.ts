"use client";

export function buildDeleteConfirmationPhrase(
	rubricId: string,
	assessmentCount: number,
): string {
	return `delete ${rubricId} (${assessmentCount} assessments)`;
}

export function matchesDeleteConfirmation(
	actual: string,
	expected: string,
): boolean {
	return (
		actual.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase()
	);
}
