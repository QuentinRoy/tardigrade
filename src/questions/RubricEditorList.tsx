"use client";

import { Button, Stack } from "@mui/material";
import type { ReactElement } from "react";
import BooleanRubricEditorPaper from "./BooleanRubricEditorPaper.tsx";
import type { QuestionRubricFieldErrors } from "./errors.ts";
import NumericalRubricEditorPaper from "./NumericalRubricEditorPaper.tsx";
import OrdinalRubricEditorPaper from "./OrdinalRubricEditorPaper.tsx";
import { createRubric } from "./RubricEditorPaper.tsx";
import type { RubricEditorValue } from "./types.ts";

type RubricEditorListProps = {
	rubrics: RubricEditorValue[];
	onChange: (rubrics: RubricEditorValue[]) => void;
	fieldErrors?: QuestionRubricFieldErrors[] | undefined;
};

export default function RubricEditorList({
	rubrics,
	onChange,
	fieldErrors,
}: RubricEditorListProps): ReactElement {
	const addRubric = (type: RubricEditorValue["type"]) => {
		onChange([...rubrics, createRubric(type)]);
	};

	const updateRubric = (index: number, rubric: RubricEditorValue) => {
		const next = [...rubrics];
		next[index] = rubric;
		onChange(next);
	};

	const removeRubric = (index: number) => {
		onChange(rubrics.filter((_, i) => i !== index));
	};

	return (
		<Stack spacing={2}>
			<Stack spacing={2}>
				{rubrics.map((rubric, index) => {
					const rubricError = fieldErrors?.[index];
					const key = `${rubric.previousId ?? "new"}-${index}`;

					if (rubric.type === "boolean") {
						return (
							<BooleanRubricEditorPaper
								key={key}
								rubric={rubric}
								onChange={(updated) => updateRubric(index, updated)}
								onRemove={() => removeRubric(index)}
								fieldErrors={rubricError}
							/>
						);
					}

					if (rubric.type === "ordinal") {
						return (
							<OrdinalRubricEditorPaper
								key={key}
								rubric={rubric}
								onChange={(updated) => updateRubric(index, updated)}
								onRemove={() => removeRubric(index)}
								fieldErrors={rubricError}
							/>
						);
					}

					return (
						<NumericalRubricEditorPaper
							key={key}
							rubric={rubric}
							onChange={(updated) => updateRubric(index, updated)}
							onRemove={() => removeRubric(index)}
							fieldErrors={rubricError}
						/>
					);
				})}
			</Stack>
			<Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
				<Button variant="outlined" onClick={() => addRubric("boolean")}>
					Add boolean rubric
				</Button>
				<Button variant="outlined" onClick={() => addRubric("ordinal")}>
					Add ordinal rubric
				</Button>
				<Button variant="outlined" onClick={() => addRubric("numerical")}>
					Add numerical rubric
				</Button>
			</Stack>
		</Stack>
	);
}
