import { promises as fs } from "fs";
import yaml from "js-yaml";
import path from "path";

export type GridItem = {
  label: string;
  mark: number;
};

export type Question = {
  label?: string;
  grid: GridItem[];
};

export type Grid = {
  [id: string]: Question;
};

export default async function loadQuestions(): Promise<Grid> {
  let file = await fs.readFile(
    path.join(process.cwd(), "data/questions.yaml"),
    "utf8",
  );
  return yaml.load(file) as Grid;
}
