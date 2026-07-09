export const QUESTIONS_YAML_PLACEHOLDER = `questions:
  - id: q1
    label: Question 1
    criteria:
      - id: r1
        label: Criterion 1
        description: Optional description shown under the label.
        kind: check
        marks: 1
        falseMarks: 0
  - id: q2
    label: Question 2
    criteria:
      - id: r2
        label: Good
        kind: options
        marks:
          excellent: 2
          good: 1
          poor: 0`;

export const STUDENTS_CSV_PLACEHOLDER = `last_name,first_name,id,team
Doe,John,john_doe,
Smith,Jane,jane_smith,
Johnson,Bob,bob_johnson,Team A`;

export const ASSESSMENTS_CSV_PLACEHOLDER = `submission_type,submitter,q1:r1,q2:r2
individual,jane_smith,,
individual,john_doe,true,good
team,Team A,false,excellent`;
