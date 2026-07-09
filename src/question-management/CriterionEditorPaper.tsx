"use client";

import {
	Button,
	Divider,
	Group,
	Select,
	Stack,
	TextInput,
} from "@mantine/core";
import type { ReactElement, ReactNode } from "react";
import Panel from "#design-system/Panel.tsx";
import { assertNever } from "#utils/utils.ts";
import type { QuestionCriterionFieldErrors } from "./errors.ts";
import type { CriterionEditorValue } from "./types.ts";

function createCheckCriterion(): Extract<
	CriterionEditorValue,
	{ kind: "check" }
> {
	return {
		id: "",
		kind: "check",
		label: "",
		description: "",
		marks: 1,
		falseMarks: 0,
	};
}

function createOptionsCriterion(): Extract<
	CriterionEditorValue,
	{ kind: "options" }
> {
	return {
		id: "",
		kind: "options",
		label: "",
		description: "",
		marks: { Pass: 1, Fail: 0 },
	};
}

function createNumberCriterion(): Extract<
	CriterionEditorValue,
	{ kind: "number" }
> {
	return {
		id: "",
		kind: "number",
		label: "",
		description: "",
		minScore: 0,
		maxScore: 1,
		minMarks: 0,
		maxMarks: 1,
		reversed: false,
	};
}

export function createCriterion(
	kind: CriterionEditorValue["kind"],
): CriterionEditorValue {
	switch (kind) {
		case "check":
			return createCheckCriterion();
		case "options":
			return createOptionsCriterion();
		case "number":
			return createNumberCriterion();
		default:
			assertNever(kind);
	}
}

const CRITERION_KINDS = ["check", "options", "number"] as const;

function isCriterionKind(value: string): value is CriterionEditorValue["kind"] {
	return CRITERION_KINDS.some((kind) => kind === value);
}

const CRITERION_KIND_DATA = [
	{ value: "check", label: "Check" },
	{ value: "options", label: "Options" },
	{ value: "number", label: "Number" },
];

type CriterionEditorPaperProps = {
	criterion: CriterionEditorValue;
	onChange: (criterion: CriterionEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionCriterionFieldErrors | undefined;
	children: ReactNode;
};

export default function CriterionEditorPaper({
	criterion,
	onChange,
	onRemove,
	fieldErrors,
	children,
}: CriterionEditorPaperProps): ReactElement {
	return (
		<Panel>
			<Stack gap="sm">
				<Group wrap="wrap">
					<TextInput
						label="Criterion id"
						value={criterion.id}
						onChange={(event) =>
							onChange({ ...criterion, id: event.currentTarget.value })
						}
						error={fieldErrors?.id}
						required
						size="sm"
					/>
					<Select
						label="Kind"
						value={criterion.kind}
						data={CRITERION_KIND_DATA}
						onChange={(value) => {
							if (value == null || !isCriterionKind(value)) return;
							const replacement = createCriterion(value);
							onChange({
								...replacement,
								id: criterion.id,
								previousId: criterion.previousId,
							});
						}}
						size="sm"
						miw={160}
						allowDeselect={false}
					/>
					<Button
						variant="outline"
						color="red"
						size="sm"
						onClick={onRemove}
						style={{ alignSelf: "flex-end" }}
					>
						Remove criterion
					</Button>
				</Group>

				<TextInput
					label="Label"
					value={criterion.label ?? ""}
					onChange={(event) =>
						onChange({ ...criterion, label: event.currentTarget.value })
					}
					size="sm"
				/>

				<TextInput
					label="Description"
					value={criterion.description ?? ""}
					onChange={(event) =>
						onChange({ ...criterion, description: event.currentTarget.value })
					}
					size="sm"
				/>

				<Divider />

				{children}
			</Stack>
		</Panel>
	);
}
