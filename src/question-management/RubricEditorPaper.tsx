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
import type { QuestionRubricFieldErrors } from "./errors.ts";
import type { RubricEditorValue } from "./types.ts";

function createBooleanRubric(): Extract<
	RubricEditorValue,
	{ type: "boolean" }
> {
	return {
		id: "",
		type: "boolean",
		label: "",
		description: "",
		marks: 1,
		falseMarks: 0,
	};
}

function createOrdinalRubric(): Extract<
	RubricEditorValue,
	{ type: "ordinal" }
> {
	return {
		id: "",
		type: "ordinal",
		label: "",
		description: "",
		marks: { Pass: 1, Fail: 0 },
	};
}

function createNumericalRubric(): Extract<
	RubricEditorValue,
	{ type: "numerical" }
> {
	return {
		id: "",
		type: "numerical",
		label: "",
		description: "",
		minScore: 0,
		maxScore: 1,
		minMarks: 0,
		maxMarks: 1,
		reversed: false,
	};
}

export function createRubric(
	type: RubricEditorValue["type"],
): RubricEditorValue {
	switch (type) {
		case "boolean":
			return createBooleanRubric();
		case "ordinal":
			return createOrdinalRubric();
		case "numerical":
			return createNumericalRubric();
		default:
			assertNever(type);
	}
}

const RUBRIC_TYPES = ["boolean", "ordinal", "numerical"] as const;

function isRubricType(value: string): value is RubricEditorValue["type"] {
	return RUBRIC_TYPES.some((type) => type === value);
}

const RUBRIC_TYPE_DATA = [
	{ value: "boolean", label: "Boolean" },
	{ value: "ordinal", label: "Ordinal" },
	{ value: "numerical", label: "Numerical" },
];

type RubricEditorPaperProps = {
	rubric: RubricEditorValue;
	onChange: (rubric: RubricEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionRubricFieldErrors | undefined;
	children: ReactNode;
};

export default function RubricEditorPaper({
	rubric,
	onChange,
	onRemove,
	fieldErrors,
	children,
}: RubricEditorPaperProps): ReactElement {
	return (
		<Panel>
			<Stack gap="sm">
				<Group wrap="wrap">
					<TextInput
						label="Rubric id"
						value={rubric.id}
						onChange={(event) =>
							onChange({ ...rubric, id: event.currentTarget.value })
						}
						error={fieldErrors?.id}
						required
						size="sm"
					/>
					<Select
						label="Type"
						value={rubric.type}
						data={RUBRIC_TYPE_DATA}
						onChange={(value) => {
							if (value == null || !isRubricType(value)) return;
							const replacement = createRubric(value);
							onChange({
								...replacement,
								id: rubric.id,
								previousId: rubric.previousId,
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
						Remove rubric
					</Button>
				</Group>

				<TextInput
					label="Label"
					value={rubric.label ?? ""}
					onChange={(event) =>
						onChange({ ...rubric, label: event.currentTarget.value })
					}
					size="sm"
				/>

				<TextInput
					label="Description"
					value={rubric.description ?? ""}
					onChange={(event) =>
						onChange({ ...rubric, description: event.currentTarget.value })
					}
					size="sm"
				/>

				<Divider />

				{children}
			</Stack>
		</Panel>
	);
}
