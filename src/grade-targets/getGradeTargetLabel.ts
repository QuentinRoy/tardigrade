import type { GradeTarget } from "#grade-targets/types.ts";

export function getGradeTargetLabel(target: GradeTarget): string {
	if (target.displayLabel != null && target.displayLabel.length > 0) {
		return target.displayLabel;
	}
	if (target.kind === "group" && target.groupName) {
		return target.groupName;
	}
	if (target.kind === "individual" && target.studentName) {
		return target.studentName;
	}
	return target.id;
}
