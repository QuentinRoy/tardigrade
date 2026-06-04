"use server";

import {
	saveAssessment as persistAssessment,
	type SaveAssessmentParams,
} from "#assessments/assessmentMutations.ts";

export async function saveAssessment(params: SaveAssessmentParams) {
	return persistAssessment(params);
}
