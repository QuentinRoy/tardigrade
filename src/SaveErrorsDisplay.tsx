"use client";

import MuiAlert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Link from "@mui/material/Link";
import NextLink from "next/link";
import React from "react";
import { useSaveErrors } from "./SaveErrorsContext";

export function SaveErrorsDisplay() {
  const { errors, dismissError } = useSaveErrors();

  if (errors.length === 0) return null;

  return (
    <Box
      sx={{
        position: "fixed",
        bottom: 16,
        left: 16,
        zIndex: 2000,
        display: "flex",
        flexDirection: "column",
        gap: 1,
        maxWidth: 480,
      }}
    >
      {errors.map((error) => (
        <MuiAlert
          key={error.id}
          severity="error"
          elevation={6}
          variant="filled"
          onClose={() => dismissError(error.id)}
        >
          Failed to save grading for{" "}
          <Link
            component={NextLink}
            href={`/${error.questionId}/${error.paperId}`}
            color="inherit"
            sx={{ fontWeight: "bold" }}
          >
            {error.questionLabel ?? error.questionId} /{" "}
            {error.paperLabel ?? error.paperId}
          </Link>
          . {error.message}
        </MuiAlert>
      ))}
    </Box>
  );
}
