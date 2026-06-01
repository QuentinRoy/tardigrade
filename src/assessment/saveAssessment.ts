"use server";

import {
	type SaveAssessmentParams,
	saveAssessment as saveAssessmentInDb,
} from "#db/assessmentMutations.ts";

export async function saveAssessment(params: SaveAssessmentParams) {
	return saveAssessmentInDb(params);
}
