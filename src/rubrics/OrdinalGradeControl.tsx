"use client";

import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import type { ReactElement } from "react";

type OrdinalGradeControlProps = {
	value?: string;
	marks: Record<string, number>;
	disabled: boolean;
	onAssess: (value: string) => void;
};

export default function OrdinalGradeControl({
	value,
	marks,
	disabled,
	onAssess,
}: OrdinalGradeControlProps): ReactElement {
	return (
		<ToggleButtonGroup
			value={value ?? null}
			orientation="vertical"
			exclusive
			sx={{ width: "fit-content", alignItems: "stretch" }}
			onChange={(_, value: string | null) => {
				if (value != null) {
					onAssess(value);
				}
			}}
			aria-label="Ordinal rubric assessment"
			disabled={disabled}
		>
			{Object.entries(marks).map(([valueLabel, valueScore]) => (
				<ToggleButton
					key={valueLabel}
					size="small"
					value={valueLabel}
					aria-label={valueLabel}
					color="primary"
					sx={{
						justifyContent: "flex-start",
						textTransform: "none",
						width: "100%",
						whiteSpace: "nowrap",
						gap: 1.5,
					}}
				>
					<Box
						sx={{
							flex: 1,
							minWidth: 0,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
							textAlign: "left",
						}}
					>
						{valueLabel}
					</Box>
					<Box sx={{ marginLeft: "auto", flexShrink: 0 }}>({valueScore})</Box>
				</ToggleButton>
			))}
		</ToggleButtonGroup>
	);
}
