export type GradeTargetNavigation<TTarget extends { id: string }> = {
	currentTargetIndex: number;
	currentTarget: TTarget | undefined;
	previousTarget: TTarget | undefined;
	nextTarget: TTarget | undefined;
};

export function getGradeTargetNavigation<TTarget extends { id: string }>(
	targets: TTarget[],
	currentTargetId: string,
): GradeTargetNavigation<TTarget> {
	const currentTargetIndex = targets.findIndex(
		(target) => target.id === currentTargetId,
	);
	const currentTarget =
		currentTargetIndex === -1 ? undefined : targets[currentTargetIndex];
	const previousTarget =
		currentTargetIndex > 0 ? targets[currentTargetIndex - 1] : undefined;
	const nextTarget =
		currentTargetIndex >= 0 && currentTargetIndex < targets.length - 1
			? targets[currentTargetIndex + 1]
			: undefined;

	return { currentTargetIndex, currentTarget, previousTarget, nextTarget };
}
