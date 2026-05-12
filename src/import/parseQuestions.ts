import yaml from "js-yaml";
import { questionsSchema } from "./schemas";
import type { ImportedQuestion } from "./types";

export function parseQuestionsYaml(content: string): ImportedQuestion[] {
  const parsed = yaml.load(content);
  return questionsSchema.parse(parsed).questions;
}
