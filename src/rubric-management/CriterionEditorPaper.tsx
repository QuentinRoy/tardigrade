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
import {
	CRITERION_KINDS,
	createCriterion,
	isCriterionKind,
} from "#criteria/criterionKinds.ts";
import type { CriterionDefinitionInput } from "#criteria/types.ts";
import Panel from "#design-system/Panel.tsx";
import type { RubricCriterionFieldErrors } from "./errors.ts";

const CRITERION_KIND_DATA = CRITERION_KINDS.map((kind) => ({
	value: kind,
	label: kind,
}));

type CriterionEditorPaperProps = {
	criterion: CriterionDefinitionInput;
	onChange: (criterion: CriterionDefinitionInput) => void;
	onRemove: () => void;
	fieldErrors?: RubricCriterionFieldErrors | undefined;
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
						styles={{
							input: { textTransform: "capitalize" },
							option: { textTransform: "capitalize" },
						}}
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
