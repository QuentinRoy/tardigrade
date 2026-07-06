import { Center } from "@mantine/core";
import type { ReactElement } from "react";
import classes from "./AssessmentStatus.module.css";

type AssessmentStatusProps = {
	assessmentStatus: "unassessed" | "assessed";
	isSaving: boolean;
};

export default function AssessmentStatus({
	assessmentStatus,
	isSaving,
}: AssessmentStatusProps): ReactElement {
	return (
		<Center aria-hidden flex="0 0 auto">
			<span
				className={classes.dot}
				data-status={assessmentStatus}
				data-saving={isSaving || undefined}
			/>
		</Center>
	);
}
