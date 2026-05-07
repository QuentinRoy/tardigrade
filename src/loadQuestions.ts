import { promises as fs } from "fs";
import yaml from "js-yaml";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");
const QUESTION_DATA_FILE_PATH = path.join(DATA_DIR, "questions.yaml");
const SOLUTION_DIR_PATH = path.join(DATA_DIR, "solutions");

export type Rubric = {
  label: string;
  marks: number;
};

export type Question = {
  label?: string;
  rubrics: Rubric[];
  solution?: string;
};

export type Grid = {
  [id: string]: Question;
};

export default async function loadQuestions(): Promise<Grid> {
  let file = await fs.readFile(QUESTION_DATA_FILE_PATH, "utf8");
  let grid = yaml.load(file) as Grid;
  await Promise.all(
    Object.entries(grid).map(async ([questionId]) => {
      try {
        let solutionFile = await fs.readFile(
          path.join(SOLUTION_DIR_PATH, `${questionId}.js`),
        );
        grid[questionId].solution = solutionFile.toString();
      } catch (err) {
        // ENOENT errors happens when the file could not be found, which
        // would happen if there is no provided solution.
        if (err?.code !== "ENOENT") throw err;
      }
    }),
  );
  return grid;
}
