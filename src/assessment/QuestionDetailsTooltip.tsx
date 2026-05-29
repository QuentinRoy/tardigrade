"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";

type QuestionDetailsTooltipProps = {
	questionId: string;
	questionLabel: string;
};

export default function QuestionDetailsTooltip({
	questionId,
	questionLabel,
}: QuestionDetailsTooltipProps): ReactElement {
	return (
		<Tooltip
			placement="right-start"
			title={<Typography variant="subtitle2">{questionLabel}</Typography>}
			arrow
			enterDelay={120}
		>
			<Box
				component="span"
				sx={{
					display: "inline-flex",
					alignItems: "center",
					gap: 0.5,
					cursor: "help",
				}}
			>
				<Typography
					component="span"
					variant="body2"
					sx={{ textDecoration: "underline dotted" }}
				>
					{questionId}
				</Typography>
				<InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
			</Box>
		</Tooltip>
	);
}
