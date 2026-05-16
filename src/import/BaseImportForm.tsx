"use client";

import HelpOutlineIcon from "@mui/icons-material/HelpOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Container from "@mui/material/Container";
import Dialog from "@mui/material/Dialog";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
  type DragEvent,
  type ReactElement,
  type ReactNode,
  useActionState,
  useState,
} from "react";
import { useFormStatus } from "react-dom";
import type { ImportState } from "./importState";
import { initialImportState } from "./importState";

type ImportAction = (
  previousState: ImportState,
  formData: FormData,
) => Promise<ImportState>;

type BaseImportFormProps = {
  title: string;
  description: string;
  fieldLabel: string;
  fieldName: string;
  placeholder: string;
  minRows: number;
  submitLabel: string;
  helpTitle: string;
  helpContent: ReactNode;
  helperText: string;
  defaultValue?: string;
  action: ImportAction;
};

function SubmitButton({ label }: { label: string }): ReactElement {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" variant="contained" disabled={pending}>
      {pending ? "Importing..." : label}
    </Button>
  );
}

function useDrop(setValue: (text: string) => void) {
  const [isDragging, setIsDragging] = useState(false);

  function onDragOver(event: DragEvent) {
    event.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave() {
    setIsDragging(false);
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setIsDragging(false);

    const file = event.dataTransfer.files[0];
    if (file == null) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const text = loadEvent.target?.result;
      if (typeof text === "string") {
        setValue(text);
      }
    };
    reader.readAsText(file);
  }

  return { isDragging, onDragOver, onDragLeave, onDrop };
}

export default function BaseImportForm({
  action,
  defaultValue,
  description,
  fieldLabel,
  fieldName,
  helpContent,
  helperText,
  helpTitle,
  minRows,
  placeholder,
  submitLabel,
  title,
}: BaseImportFormProps): ReactElement {
  const [state, formAction] = useActionState(action, initialImportState);
  const [value, setValue] = useState(defaultValue ?? "");
  const [helpOpen, setHelpOpen] = useState(false);

  const drop = useDrop(setValue);

  return (
    <Container component="main" maxWidth="lg" sx={{ py: 5 }}>
      <Stack spacing={3}>
        <Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", mb: 1 }}
          >
            <Typography variant="h3" component="h1">
              {title}
            </Typography>
            <Tooltip title="Show format reference">
              <IconButton
                size="small"
                onClick={() => setHelpOpen(true)}
                aria-label="Show import format help"
              >
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 0.5 }}>
            {description}
          </Typography>
        </Box>

        <Dialog
          open={helpOpen}
          onClose={() => setHelpOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>{helpTitle}</DialogTitle>
          <DialogContent>
            <Stack spacing={3} sx={{ pt: 2 }}>
              <Box>{helpContent}</Box>
            </Stack>
          </DialogContent>
        </Dialog>

        {state.status === "success" && state.message ? (
          <Alert severity="success">{state.message}</Alert>
        ) : null}

        {state.status === "error" && state.errors != null ? (
          <Alert severity="error">{state.errors.join(" | ")}</Alert>
        ) : null}

        <Box component="form" action={formAction}>
          <Stack spacing={3}>
            <Box
              onDragOver={drop.onDragOver}
              onDragLeave={drop.onDragLeave}
              onDrop={drop.onDrop}
              sx={{
                borderRadius: 1,
                outline: drop.isDragging ? "2px dashed" : "none",
                outlineColor: "primary.main",
              }}
            >
              <TextField
                label={fieldLabel}
                name={fieldName}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                multiline
                minRows={minRows}
                fullWidth
                required
                spellCheck={false}
                placeholder={placeholder}
                helperText={helperText}
              />
            </Box>

            <SubmitButton label={submitLabel} />
          </Stack>
        </Box>
      </Stack>
    </Container>
  );
}
