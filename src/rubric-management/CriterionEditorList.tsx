"use client";

import { Button, Group, Stack } from "@mantine/core";
import type { ReactElement } from "react";
import { CRITERION_KINDS, createCriterion } from "#criteria/criterionKinds.ts";
import { getCriterionKindLabel } from "#criteria/getCriterionKindLabel.ts";
import type { CriterionDefinitionInput } from "#criteria/types.ts";
import CheckEditorPaper from "./CheckEditorPaper.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";
import NumberEditorPaper from "./NumberEditorPaper.tsx";
import OptionsEditorPaper from "./OptionsEditorPaper.tsx";

type CriterionEditorListProps = {
	criteria: CriterionDefinitionInput[];
	onChange: (criteria: CriterionDefinitionInput[]) => void;
	fieldErrors?: RubricCriterionFieldErrors[] | undefined;
};

export default function CriterionEditorList({
	criteria,
	onChange,
	fieldErrors,
}: CriterionEditorListProps): ReactElement {
	const addCriterion = (kind: CriterionDefinitionInput["kind"]) => {
		onChange([...criteria, createCriterion(kind)]);
	};

	const updateCriterion = (
		index: number,
		criterion: CriterionDefinitionInput,
	) => {
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
				{CRITERION_KINDS.map((kind) => (
					<Button
						key={kind}
						variant="outline"
						onClick={() => addCriterion(kind)}
					>
						Add {getCriterionKindLabel(kind)} criterion
					</Button>
				))}
			</Group>
		</Stack>
	);
}
