"use client";

import { keyframes } from "@emotion/react";
import type { Theme } from "@mui/material";
import Box from "@mui/material/Box";
import type { ReactElement } from "react";
import { assertNever } from "@/utils/utils";

type RubricStatusMarkerProps = {
  assessmentStatus: "unassessed" | "assessed";
  isSaving: boolean;
};

const savingPulse = keyframes`
  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.4);
  }
`;

function getStatusColor(
  assessmentStatus: RubricStatusMarkerProps["assessmentStatus"],
  theme: Theme,
) {
  switch (assessmentStatus) {
    case "unassessed":
      return theme.palette.secondary.light;
    case "assessed":
      return theme.palette.success.light;
    default:
      assertNever(assessmentStatus);
  }
}

export default function RubricStatusMarker({
  assessmentStatus,
  isSaving,
}: RubricStatusMarkerProps): ReactElement {
  return (
    <Box
      aria-hidden
      sx={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={(theme) => ({
          width: 8,
          height: 8,
          borderRadius: "50%",
          bgcolor: getStatusColor(assessmentStatus, theme),
          transition: theme.transitions.create("background-color", {
            duration: theme.transitions.duration.shortest,
          }),
          animation: isSaving
            ? `${savingPulse} 1.2s ease-in-out infinite`
            : "none",
        })}
      />
    </Box>
  );
}
