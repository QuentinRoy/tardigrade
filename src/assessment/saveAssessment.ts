"use server";

import {
	type SaveAssessmentParams,
	saveAssessment as saveAssessmentInDb,
} from "../db/assessments";

export async function saveAssessment(params: SaveAssessmentParams) {
	return saveAssessmentInDb(params);
}
