"use client";

import {
	ActionIcon,
	Alert,
	Box,
	Button,
	Container,
	Group,
	Modal,
	Stack,
	Text,
	Textarea,
	Title,
	Tooltip,
} from "@mantine/core";
import { IconHelpCircle } from "@tabler/icons-react";
import {
	type DragEvent,
	type ReactElement,
	type ReactNode,
	useActionState,
	useState,
} from "react";
import { useFormStatus } from "react-dom";
import { type ActionState, initialActionState } from "#utils/actionState.ts";

type ImportAction = (
	previousState: ActionState,
	formData: FormData,
) => Promise<ActionState>;

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
	defaultValue?: string | undefined;
	action: ImportAction;
};

function SubmitButton({ label }: { label: string }): ReactElement {
	const { pending } = useFormStatus();

	return (
		<Button type="submit" loading={pending}>
			{label}
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
	const [state, formAction] = useActionState(action, initialActionState);
	const [value, setValue] = useState(defaultValue ?? "");
	const [helpOpen, setHelpOpen] = useState(false);

	const drop = useDrop(setValue);

	return (
		<Container component="main" size="lg" py="xl">
			<Stack gap="xl">
				<Stack gap="xs">
					<Group gap="xs" align="center">
						<Title order={1}>{title}</Title>
						<Tooltip label="Show import format help">
							<ActionIcon
								size="sm"
								variant="subtle"
								onClick={() => setHelpOpen(true)}
								aria-label="Show import format help"
							>
								<IconHelpCircle size={16} />
							</ActionIcon>
						</Tooltip>
					</Group>
					<Text c="dimmed">{description}</Text>
				</Stack>

				<Modal
					opened={helpOpen}
					onClose={() => setHelpOpen(false)}
					title={helpTitle}
					size="lg"
				>
					{helpContent}
				</Modal>

				{state.status === "success" && state.message ? (
					<Alert color="green" variant="light">
						{state.message}
					</Alert>
				) : null}

				{state.status === "error" && state.errors != null ? (
					<Alert color="red" variant="light">
						{state.errors.join(" | ")}
					</Alert>
				) : null}

				<Box component="form" action={formAction}>
					<Stack gap="xl">
						<Box
							onDragOver={drop.onDragOver}
							onDragLeave={drop.onDragLeave}
							onDrop={drop.onDrop}
							bdrs="sm"
							style={{
								outline: drop.isDragging
									? "2px dashed var(--mantine-primary-color-filled)"
									: "none",
							}}
						>
							<Textarea
								label={fieldLabel}
								name={fieldName}
								value={value}
								onChange={(event) => setValue(event.currentTarget.value)}
								minRows={minRows}
								autosize
								required
								spellCheck={false}
								placeholder={placeholder}
								description={helperText}
							/>
						</Box>

						<SubmitButton label={submitLabel} />
					</Stack>
				</Box>
			</Stack>
		</Container>
	);
}
