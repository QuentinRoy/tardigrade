"use client";

import { Code, Stack, Text } from "@mantine/core";
import type { ReactElement } from "react";
import BaseImportForm from "#imports/BaseImportForm.tsx";
import { STUDENTS_CSV_PLACEHOLDER } from "#imports/constants.ts";
import type { ActionState } from "#utils/actionState.ts";

type StudentsImportFormProps = {
	defaultStudentsCsv?: string;
	action: (
		previousState: ActionState,
		formData: FormData,
	) => Promise<ActionState>;
};

export default function StudentsImportForm({
	action,
	defaultStudentsCsv,
}: StudentsImportFormProps): ReactElement {
	return (
		<BaseImportForm
			action={action}
			defaultValue={defaultStudentsCsv}
			title="Import Students"
			description="Load student or team data into the database."
			fieldLabel="Students CSV"
			fieldName="studentsCsv"
			placeholder={STUDENTS_CSV_PLACEHOLDER}
			minRows={12}
			submitLabel="Import students"
			helperText="Drop a .csv file here to fill this field"
			helpTitle="Students Import Format Reference"
			helpContent={
				<Stack gap="sm">
					<Text fw={600}>Students CSV</Text>
					<Text size="sm" c="dimmed">
						Required columns: <code>last_name</code>, <code>first_name</code>,{" "}
						<code>id</code>. Optional: <code>team</code> (students sharing a
						team get grouped into the same submission).
					</Text>
					<Code block>{STUDENTS_CSV_PLACEHOLDER}</Code>
				</Stack>
			}
		/>
	);
}
