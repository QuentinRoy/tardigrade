import { Center } from "@mantine/core";
import type { ReactElement } from "react";
import classes from "./GradeStatus.module.css";

type GradeStatusProps = {
	gradeStatus: "ungraded" | "graded";
	isSaving: boolean;
};

export default function GradeStatus({
	gradeStatus,
	isSaving,
}: GradeStatusProps): ReactElement {
	return (
		<Center aria-hidden flex="0 0 auto">
			<span
				className={classes.dot}
				data-status={gradeStatus}
				data-saving={isSaving || undefined}
			/>
		</Center>
	);
}
