"use client";

import {
	Button,
	Divider,
	FormControl,
	InputLabel,
	MenuItem,
	Paper,
	Select,
	Stack,
	TextField,
} from "@mui/material";
import type { ReactElement, ReactNode } from "react";
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
		<Paper variant="outlined" sx={{ p: 2 }}>
			<Stack spacing={2}>
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
					<TextField
						label="Rubric id"
						value={rubric.id}
						onChange={(event) =>
							onChange({ ...rubric, id: event.target.value })
						}
						error={fieldErrors?.id != null}
						helperText={fieldErrors?.id ?? ""}
						required
						size="small"
					/>
					<FormControl size="small" sx={{ minWidth: 160 }}>
						<InputLabel>Type</InputLabel>
						<Select
							value={rubric.type}
							label="Type"
							onChange={(event) => {
								const replacement = createRubric(event.target.value);
								onChange({
									...replacement,
									id: rubric.id,
									previousId: rubric.previousId,
								});
							}}
						>
							<MenuItem value="boolean">Boolean</MenuItem>
							<MenuItem value="ordinal">Ordinal</MenuItem>
							<MenuItem value="numerical">Numerical</MenuItem>
						</Select>
					</FormControl>
					<Button variant="outlined" color="error" onClick={onRemove}>
						Remove rubric
					</Button>
				</Stack>

				<TextField
					label="Label"
					value={rubric.label ?? ""}
					onChange={(event) =>
						onChange({ ...rubric, label: event.target.value })
					}
					size="small"
				/>

				<TextField
					label="Description"
					value={rubric.description ?? ""}
					onChange={(event) =>
						onChange({ ...rubric, description: event.target.value })
					}
					size="small"
				/>

				<Divider />

				{children}
			</Stack>
		</Paper>
	);
}
