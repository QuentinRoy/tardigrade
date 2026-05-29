"use client";

import CheckIcon from "@mui/icons-material/Check";
import CrossIcon from "@mui/icons-material/Clear";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ReactElement } from "react";

type BooleanGradeControlProps = {
	value?: boolean;
	disabled: boolean;
	onAssess: (value: boolean) => void;
};

export default function BooleanGradeControl({
	value,
	disabled,
	onAssess,
}: BooleanGradeControlProps): ReactElement {
	const buttonValue = value ?? null;

	return (
		<ToggleButtonGroup
			value={buttonValue}
			exclusive
			onChange={(_, value: boolean | null) => {
				if (value != null) {
					onAssess(value);
				}
			}}
			aria-label="Boolean rubric assessment"
			disabled={disabled}
		>
			<ToggleButton size="small" value={true} aria-label="true" color="primary">
				<CheckIcon color={value === true ? "primary" : "inherit"} />
			</ToggleButton>
			<ToggleButton size="small" value={false} color="error" aria-label="false">
				<CrossIcon color={value === false ? "error" : "inherit"} />
			</ToggleButton>
		</ToggleButtonGroup>
	);
}
