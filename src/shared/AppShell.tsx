"use client";

import MenuIcon from "@mui/icons-material/Menu";
import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import NextLink from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { useLocalStorage } from "@/utils/useLocalStorage";

const DRAWER_WIDTH = 280;

type NavigationItem = {
  label: string;
  href: string;
};

const ASSESSMENT_ITEMS: NavigationItem[] = [
  { label: "Assessments", href: "/assessments" },
];

const MANAGEMENT_ITEMS: NavigationItem[] = [
  { label: "Manage Questions", href: "/questions" },
];

const IMPORT_ITEMS: NavigationItem[] = [
  { label: "Import Questions", href: "/import/questions" },
  { label: "Import Students", href: "/import/students" },
  { label: "Import Assessments", href: "/import/assessments" },
];

const EXPORT_STORAGE_KEY = "export-csv-options-v1";

type ExportPersistedOptions = {
  includeRubricAssessment: boolean;
  includeRubricMarks: boolean;
};

const DEFAULT_EXPORT_OPTIONS: ExportPersistedOptions = {
  includeRubricAssessment: true,
  includeRubricMarks: false,
};

function deserializeExportOptions(raw: string): ExportPersistedOptions {
  const parsed = JSON.parse(raw) as unknown;
  if (typeof parsed !== "object" || parsed == null) {
    return DEFAULT_EXPORT_OPTIONS;
  }

  return {
    includeRubricAssessment:
      "includeRubricAssessment" in parsed &&
      parsed.includeRubricAssessment === true,
    includeRubricMarks:
      "includeRubricMarks" in parsed && parsed.includeRubricMarks === true,
  };
}

type AppShellProps = {
  children: ReactNode;
};

function NavigationZone({
  title,
  items,
  onNavigate,
}: {
  title: string;
  items: NavigationItem[];
  onNavigate?: () => void;
}): ReactNode {
  return (
    <Box sx={{ px: 2, py: 1.5 }}>
      <Typography component="p" variant="overline" color="text.secondary">
        {title}
      </Typography>
      <List disablePadding>
        {items.map((item) => (
          <ListItemButton
            key={item.href}
            component={NextLink}
            href={item.href}
            onClick={onNavigate}
            sx={{ borderRadius: 1 }}
          >
            <ListItemText primary={item.label} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  );
}

function DrawerContent({ onNavigate }: { onNavigate?: () => void }): ReactNode {
  const [exportOptions, setExportOptions] =
    useLocalStorage<ExportPersistedOptions>(
      EXPORT_STORAGE_KEY,
      DEFAULT_EXPORT_OPTIONS,
      { deserialize: deserializeExportOptions },
    );

  const exportHref = useMemo(() => {
    const searchParams = new URLSearchParams();

    if (exportOptions.includeRubricAssessment) {
      searchParams.append("include", "rubric-assessment");
    }

    if (exportOptions.includeRubricMarks) {
      searchParams.append("include", "rubric-marks");
    }

    const query = searchParams.toString();

    return query.length > 0
      ? `/export/submissions?${query}`
      : "/export/submissions";
  }, [exportOptions]);

  return (
    <>
      <Toolbar>
        <Typography component="p" variant="subtitle1">
          Navigation
        </Typography>
      </Toolbar>
      <Divider />

      <Stack divider={<Divider flexItem />}>
        <NavigationZone
          title="Assess"
          items={ASSESSMENT_ITEMS}
          onNavigate={onNavigate}
        />
        <NavigationZone
          title="Manage"
          items={MANAGEMENT_ITEMS}
          onNavigate={onNavigate}
        />
        <NavigationZone
          title="Import"
          items={IMPORT_ITEMS}
          onNavigate={onNavigate}
        />
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography component="p" variant="overline" color="text.secondary">
            Export
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Configure CSV columns before download.
          </Typography>
          <FormGroup sx={{ mb: 2 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={exportOptions.includeRubricAssessment}
                  onChange={(event) => {
                    setExportOptions((current) => ({
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
                  checked={exportOptions.includeRubricMarks}
                  onChange={(event) => {
                    setExportOptions((current) => ({
                      ...current,
                      includeRubricMarks: event.target.checked,
                    }));
                  }}
                />
              }
              label="Rubric marks"
            />
          </FormGroup>
          <Button
            component={NextLink}
            href={exportHref}
            variant="contained"
            fullWidth
            onClick={onNavigate}
          >
            Download CSV
          </Button>
        </Box>
      </Stack>
    </>
  );
}

export default function AppShell({ children }: AppShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar
        position="fixed"
        sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={() => setDrawerOpen((current) => !current)}
            aria-label="Open navigation drawer"
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1, display: "flex", justifyContent: "center" }}>
            <Typography
              component={NextLink}
              href="/"
              variant="h6"
              sx={{ color: "inherit", textDecoration: "none" }}
            >
              BonPoint
            </Typography>
          </Box>

          <Box sx={{ width: 48, flexShrink: 0 }} aria-hidden />
        </Toolbar>
      </AppBar>

      <Box component="nav">
        <Drawer
          variant="temporary"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            "& .MuiDrawer-paper": {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          <DrawerContent onNavigate={() => setDrawerOpen(false)} />
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
