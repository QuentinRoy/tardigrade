"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { ReactElement } from "react";
import BaseImportForm from "#imports/BaseImportForm.tsx";
import { QUESTIONS_YAML_PLACEHOLDER } from "#imports/constants.ts";
import type { ActionState } from "#utils/actionState.ts";

type QuestionsImportFormProps = {
	defaultQuestionsYaml?: string;
	action: (
		previousState: ActionState,
		formData: FormData,
	) => Promise<ActionState>;
};

export default function QuestionsImportForm({
	action,
	defaultQuestionsYaml,
}: QuestionsImportFormProps): ReactElement {
	return (
		<BaseImportForm
			action={action}
			defaultValue={defaultQuestionsYaml}
			title="Import Questions"
			description="Load question rubrics into the database."
			fieldLabel="Questions YAML"
			fieldName="questionsYaml"
			placeholder={QUESTIONS_YAML_PLACEHOLDER}
			minRows={18}
			submitLabel="Import questions"
			helperText="Drop a .yaml file here to fill this field"
			helpTitle="Questions Import Format Reference"
			helpContent={
				<>
					<Typography variant="subtitle1" sx={{ fontWeight: "bold", mb: 1 }}>
						Questions YAML
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						A top-level <code>questions</code> array of question objects. Each
						question requires a stable <code>id</code>, has an optional{" "}
						<code>label</code>, and a <code>rubrics</code> array. Each rubric
						requires a stable <code>id</code>, and accepts an optional{" "}
						<code>description</code> and <code>label</code>. Boolean rubrics use{" "}
						<code>marks</code> and optional <code>falseMarks</code>, ordinal
						rubrics use <code>marks</code>, and numerical rubrics use{" "}
						<code>minScore</code>/<code>maxScore</code> and/or{" "}
						<code>minMarks</code>/<code>maxMarks</code>. Numerical rubrics can
						also set <code>reversed: true</code> to map the highest score to the
						lowest mark.
					</Typography>
					<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
						Numerical defaults and rules: <code>minScore</code> defaults to{" "}
						<code>0</code>, <code>maxScore</code> defaults to <code>1</code>. If{" "}
						<code>minScore</code> is provided, <code>maxScore</code> must be
						provided too. <code>minMarks</code>
						defaults to <code>0</code> when omitted; <code>maxMarks</code>{" "}
						defaults to <code>0</code> when omitted. At least one of{" "}
						<code>minMarks</code>/<code>maxMarks</code> must be provided.
					</Typography>
					<Box
						component="pre"
						sx={{
							bgcolor: "action.hover",
							borderRadius: 1,
							p: 2,
							fontSize: "0.8rem",
							overflowX: "auto",
							fontFamily: "monospace",
						}}
					>
						{QUESTIONS_YAML_PLACEHOLDER}
					</Box>
				</>
			}
		/>
	);
}
