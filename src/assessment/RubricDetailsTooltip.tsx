"use client";

import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import type { ReactElement, ReactNode } from "react";
import type { RubricOverviewPopupDetails } from "@/db/rubricOverviewBuilder";

type RubricDetailsTooltipProps = {
  rubricId: string;
  details: RubricOverviewPopupDetails;
};

function propertyRows(details: RubricOverviewPopupDetails): ReactNode[] {
  if (details.properties.type === "boolean") {
    return [
      <Typography key="true" variant="caption" sx={{ display: "block" }}>
        True marks: {details.properties.trueMarks}
      </Typography>,
      <Typography key="false" variant="caption" sx={{ display: "block" }}>
        False marks: {details.properties.falseMarks}
      </Typography>,
    ];
  }

  if (details.properties.type === "ordinal") {
    return details.properties.marksByLabel.map((entry) => (
      <Typography key={entry.label} variant="caption" sx={{ display: "block" }}>
        {entry.label}: {entry.marks}
      </Typography>
    ));
  }

  return [
    <Typography key="score-range" variant="caption" sx={{ display: "block" }}>
      Score range: {details.properties.minScore} - {details.properties.maxScore}
    </Typography>,
    <Typography key="marks-range" variant="caption" sx={{ display: "block" }}>
      Marks range: {details.properties.minMarks} - {details.properties.maxMarks}
    </Typography>,
    <Typography key="reversed" variant="caption" sx={{ display: "block" }}>
      Reversed: {details.properties.reversed ? "yes" : "no"}
    </Typography>,
  ];
}

export default function RubricDetailsTooltip({
  rubricId,
  details,
}: RubricDetailsTooltipProps): ReactElement {
  return (
    <Tooltip
      placement="right-start"
      title={
        <Stack sx={{ gap: 0.5 }}>
          <Typography variant="subtitle2">
            {details.label ?? rubricId}
          </Typography>
          <Typography variant="caption" color="inherit">
            Type: {details.type}
          </Typography>
          {details.description != null && details.description.length > 0 && (
            <Typography
              variant="caption"
              color="inherit"
              sx={{ display: "block" }}
            >
              {details.description}
            </Typography>
          )}
          <Box>{propertyRows(details)}</Box>
        </Stack>
      }
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
          {rubricId}
        </Typography>
        <InfoOutlinedIcon sx={{ fontSize: 14, color: "text.secondary" }} />
      </Box>
    </Tooltip>
  );
}
