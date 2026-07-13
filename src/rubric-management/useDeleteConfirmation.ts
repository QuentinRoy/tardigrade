"use client";

export function buildDeleteConfirmationPhrase(
	rubricId: string,
	gradedTargetCount: number,
): string {
	return `delete ${rubricId} (${gradedTargetCount} grades)`;
}

export function matchesDeleteConfirmation(
	actual: string,
	expected: string,
): boolean {
	return (
		actual.trim().toLocaleLowerCase() === expected.trim().toLocaleLowerCase()
	);
}
