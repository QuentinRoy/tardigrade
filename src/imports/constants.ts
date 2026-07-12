export const RUBRICS_YAML_PLACEHOLDER = `rubrics:
  - id: q1
    label: Rubric 1
    criteria:
      - id: r1
        label: Criterion 1
        description: Optional description shown under the label.
        kind: check
        marks: 1
        falseMarks: 0
  - id: q2
    label: Rubric 2
    criteria:
      - id: r2
        label: Good
        kind: options
        marks:
          excellent: 2
          good: 1
          poor: 0`;

export const STUDENTS_CSV_PLACEHOLDER = `last_name,first_name,id,group
Doe,John,john_doe,
Smith,Jane,jane_smith,
Johnson,Bob,bob_johnson,Group A`;

export const ASSESSMENTS_CSV_PLACEHOLDER = `kind,name,q1:r1,q2:r2
individual,jane_smith,,
individual,john_doe,true,good
group,Group A,false,excellent`;
