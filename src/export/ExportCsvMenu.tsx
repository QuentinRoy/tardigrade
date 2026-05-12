"use client";

import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import Menu from "@mui/material/Menu";
import Typography from "@mui/material/Typography";
import { type MouseEvent, type ReactElement, useMemo, useState } from "react";
import { useLocalStorage } from "@/utils/useLocalStorage";

const STORAGE_KEY = "export-csv-options-v1";

type PersistedOptions = {
  includeRubricAssessment: boolean;
  includeRubricMarks: boolean;
};

const DEFAULT_OPTIONS: PersistedOptions = {
  includeRubricAssessment: true,
  includeRubricMarks: false,
};

function deserializeOptions(raw: string): PersistedOptions {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed == null) {
    return DEFAULT_OPTIONS;
  }
  return {
    includeRubricAssessment:
      "includeRubricAssessment" in parsed &&
      parsed.includeRubricAssessment === true,
    includeRubricMarks:
      "includeRubricMarks" in parsed && parsed.includeRubricMarks === true,
  };
}

export default function ExportCsvMenu(): ReactElement {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [options, setOptions] = useLocalStorage<PersistedOptions>(
    STORAGE_KEY,
    DEFAULT_OPTIONS,
    { deserialize: deserializeOptions },
  );
  const open = anchorEl != null;

  const downloadHref = useMemo(() => {
    const searchParams = new URLSearchParams();

    if (options.includeRubricAssessment) {
      searchParams.append("include", "rubric-assessment");
    }

    if (options.includeRubricMarks) {
      searchParams.append("include", "rubric-marks");
    }

    const query = searchParams.toString();
    return query.length > 0
      ? `/assessments/submissions/export?${query}`
      : "/assessments/submissions/export";
  }, [options]);

  const handleOpen = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <Button variant="outlined" onClick={handleOpen}>
        Export CSV
      </Button>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        slotProps={{
          paper: {
            sx: {
              width: 340,
            },
          },
        }}
      >
        <Box sx={{ px: 2, pt: 1.5, pb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Include columns
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.includeRubricAssessment}
                  onChange={(event) => {
                    setOptions((current) => ({
                      ...current,
                      includeRubricAssessment: event.target.checked,
                    }));
                  }}
                />
              }
              label="Rubric assessment"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={options.includeRubricMarks}
                  onChange={(event) => {
                    setOptions((current) => ({
                      ...current,
                      includeRubricMarks: event.target.checked,
                    }));
                  }}
                />
              }
              label="Rubric marks"
            />
          </FormGroup>
        </Box>
        <Divider />
        <Box sx={{ p: 1.5 }}>
          <Button
            component="a"
            href={downloadHref}
            variant="contained"
            fullWidth
            onClick={handleClose}
          >
            Download CSV
          </Button>
        </Box>
      </Menu>
    </>
  );
}
