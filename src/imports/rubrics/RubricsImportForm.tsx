"use client";

import { Code, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import BaseImportForm from "#imports/BaseImportForm.tsx";
import { RUBRICS_YAML_PLACEHOLDER } from "#imports/constants.ts";
import type { ActionState } from "#utils/actionState.ts";

type RubricsImportFormProps = {
	defaultRubricsYaml?: string;
	action: (
		previousState: ActionState,
		formData: FormData,
	) => Promise<ActionState>;
};

export default function RubricsImportForm({
	action,
	defaultRubricsYaml,
}: RubricsImportFormProps): ReactElement {
	return (
		<BaseImportForm
			action={action}
			defaultValue={defaultRubricsYaml}
			title="Import Rubrics"
			description="Load rubric criteria into the database."
			fieldLabel="Rubrics YAML"
			fieldName="rubricsYaml"
			placeholder={RUBRICS_YAML_PLACEHOLDER}
			minRows={18}
			submitLabel="Import rubrics"
			helperText="Drop a .yaml file here to fill this field"
			helpTitle="Rubrics Import Format Reference"
			helpContent={
				<Stack gap="sm">
					<Text fw={600}>Rubrics YAML</Text>
					<Text size="sm" c="dimmed">
						A top-level <code>rubrics</code> array of rubric objects. Each
						rubric requires a stable <code>id</code>, has an optional{" "}
						<code>label</code>, and a <code>criteria</code> array. Each
						criterion requires a stable <code>id</code> and a <code>kind</code>{" "}
						(<code>check</code>, <code>options</code>, or <code>number</code>),
						and accepts an optional <code>description</code> and{" "}
						<code>label</code>. Check criteria use <code>marks</code> and
						optional <code>falseMarks</code>, options criteria use{" "}
						<code>marks</code>, and number criteria use <code>minScore</code>/
						<code>maxScore</code> and/or <code>minMarks</code>/
						<code>maxMarks</code>. Number criteria can also set{" "}
						<code>reversed: true</code> to map the highest score to the lowest
						mark.
					</Text>
					<Text size="sm" c="dimmed">
						Number defaults and rules: <code>minScore</code> defaults to{" "}
						<code>0</code>, <code>maxScore</code> defaults to <code>1</code>. If{" "}
						<code>minScore</code> is provided, <code>maxScore</code> must be
						provided too. <code>minMarks</code> defaults to <code>0</code> when
						omitted; <code>maxMarks</code> defaults to <code>0</code> when
						omitted. At least one of <code>minMarks</code>/<code>maxMarks</code>{" "}
						must be provided.
					</Text>
					<Code block>{RUBRICS_YAML_PLACEHOLDER}</Code>
				</Stack>
			}
		/>
	);
}
