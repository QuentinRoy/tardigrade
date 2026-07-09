import yaml from "js-yaml";
import { rubricsSchema } from "#imports/schemas.ts";
import type { ImportedRubric } from "#imports/types.ts";

export function parseRubricsYaml(content: string): ImportedRubric[] {
	const parsed = yaml.load(content);
	return rubricsSchema.parse(parsed).rubrics;
}
