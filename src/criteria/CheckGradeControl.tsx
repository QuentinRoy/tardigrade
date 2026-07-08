"use client";

import { SegmentedControl, VisuallyHidden } from "@mantine/core";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { ReactElement } from "react";

type CheckGradeControlProps = {
	value?: boolean | undefined;
	disabled: boolean;
	onAssess: (value: boolean) => void;
};

const UNSET = "";

const iconProps = { style: { display: "block" }, size: 20 };

export default function CheckGradeControl({
	value,
	disabled,
	onAssess,
}: CheckGradeControlProps): ReactElement {
	return (
		<SegmentedControl<"true" | "false" | typeof UNSET>
			aria-label="Check criterion assessment"
			value={value == null ? UNSET : value ? "true" : "false"}
			onChange={(next) => onAssess(next === "true")}
			disabled={disabled}
			color={disabled ? "gray" : value === false ? "red" : "green"}
			data={[
				{
					value: "true",
					label: (
						<>
							<IconCheck {...iconProps} aria-hidden />
							<VisuallyHidden>True</VisuallyHidden>
						</>
					),
				},
				{
					value: "false",
					label: (
						<>
							<IconX {...iconProps} aria-hidden />
							<VisuallyHidden>False</VisuallyHidden>
						</>
					),
				},
			]}
		/>
	);
}
