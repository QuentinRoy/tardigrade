"use client";

import { Stack, Switch, Typography } from "@mui/material";
import type { ReactElement } from "react";
import type { QuestionRubricFieldErrors } from "./errors.ts";
import RubricEditorPaper, { NumberField } from "./RubricEditorPaper.tsx";
import type { RubricEditorValue } from "./types.ts";

type NumericalRubric = Extract<RubricEditorValue, { type: "numerical" }>;

type NumericalRubricEditorPaperProps = {
	rubric: NumericalRubric;
	onChange: (rubric: RubricEditorValue) => void;
	onRemove: () => void;
	fieldErrors?: QuestionRubricFieldErrors | undefined;
};

export default function NumericalRubricEditorPaper({
	rubric,
	onChange,
	onRemove,
	fieldErrors,
}: NumericalRubricEditorPaperProps): ReactElement {
	return (
		<RubricEditorPaper
			rubric={rubric}
			onChange={onChange}
			onRemove={onRemove}
			fieldErrors={fieldErrors}
		>
			<Stack spacing={1}>
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
					<NumberField
						label="Min score"
						value={rubric.minScore}
						onChange={(value) => onChange({ ...rubric, minScore: value })}
					/>
					<NumberField
						label="Max score"
						value={rubric.maxScore}
						onChange={(value) => onChange({ ...rubric, maxScore: value })}
					/>
				</Stack>
				<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
					<NumberField
						label="Min marks"
						value={rubric.minMarks}
						onChange={(value) => onChange({ ...rubric, minMarks: value })}
					/>
					<NumberField
						label="Max marks"
						value={rubric.maxMarks}
						onChange={(value) => onChange({ ...rubric, maxMarks: value })}
					/>
				</Stack>
				<Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
					<Switch
						checked={rubric.reversed}
						onChange={(event) =>
							onChange({ ...rubric, reversed: event.target.checked })
						}
					/>
					<Typography>Reverse score-to-marks mapping</Typography>
				</Stack>
			</Stack>
		</RubricEditorPaper>
	);
}
