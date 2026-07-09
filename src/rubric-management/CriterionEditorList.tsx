"use client";

import { Button, Group, Stack } from "@mantine/core";
import type { ReactElement } from "react";
import CheckEditorPaper from "./CheckEditorPaper.tsx";
import { createCriterion } from "./CriterionEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";
import NumberEditorPaper from "./NumberEditorPaper.tsx";
import OptionsEditorPaper from "./OptionsEditorPaper.tsx";
import type { CriterionEditorValue } from "./types.ts";

type CriterionEditorListProps = {
	criteria: CriterionEditorValue[];
	onChange: (criteria: CriterionEditorValue[]) => void;
	fieldErrors?: RubricCriterionFieldErrors[] | undefined;
};

export default function CriterionEditorList({
	criteria,
	onChange,
	fieldErrors,
}: CriterionEditorListProps): ReactElement {
	const addCriterion = (kind: CriterionEditorValue["kind"]) => {
		onChange([...criteria, createCriterion(kind)]);
	};

	const updateCriterion = (index: number, criterion: CriterionEditorValue) => {
		const next = [...criteria];
		next[index] = criterion;
		onChange(next);
	};

	const removeCriterion = (index: number) => {
		onChange(criteria.filter((_, i) => i !== index));
	};

	return (
		<Stack gap="md">
			<Stack gap="md">
				{criteria.map((criterion, index) => {
					const criterionError = fieldErrors?.[index];
					const key = `${criterion.previousId ?? "new"}-${index}`;

					if (criterion.kind === "check") {
						return (
							<CheckEditorPaper
								key={key}
								criterion={criterion}
								onChange={(updated) => updateCriterion(index, updated)}
								onRemove={() => removeCriterion(index)}
								fieldErrors={criterionError}
							/>
						);
					}

					if (criterion.kind === "options") {
						return (
							<OptionsEditorPaper
								key={key}
								criterion={criterion}
								onChange={(updated) => updateCriterion(index, updated)}
								onRemove={() => removeCriterion(index)}
								fieldErrors={criterionError}
							/>
						);
					}

					return (
						<NumberEditorPaper
							key={key}
							criterion={criterion}
							onChange={(updated) => updateCriterion(index, updated)}
							onRemove={() => removeCriterion(index)}
							fieldErrors={criterionError}
						/>
					);
				})}
			</Stack>
			<Group wrap="wrap">
				<Button variant="outline" onClick={() => addCriterion("check")}>
					Add check criterion
				</Button>
				<Button variant="outline" onClick={() => addCriterion("options")}>
					Add options criterion
				</Button>
				<Button variant="outline" onClick={() => addCriterion("number")}>
					Add number criterion
				</Button>
			</Group>
		</Stack>
	);
}
