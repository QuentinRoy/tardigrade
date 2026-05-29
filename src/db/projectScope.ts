export function withProjectScope<T>(
	value: T,
	projectId: string | undefined,
	scope: (value: T, projectId: string) => T,
): T {
	if (projectId == null) {
		return value;
	}

	return scope(value, projectId);
}
