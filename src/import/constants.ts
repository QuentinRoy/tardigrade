export const QUESTIONS_YAML_PLACEHOLDER = `questions:
  - id: q1
    label: Question 1
    rubrics:
      - id: r1
        label: Rubric 1
        type: boolean
        marks: 1
  - id: q2
    label: Question 2
    rubrics:
      - id: r2
        label: Good
        type: ordinal
        marks:
          excellent: 2
          good: 1
          poor: 0`;

export const STUDENTS_CSV_PLACEHOLDER = `family_name,first_name,id,team
Doe,John,john_doe,
Smith,Jane,jane_smith,
Johnson,Bob,bob_johnson,Team A`;

export const ASSESSMENTS_CSV_PLACEHOLDER = `submission_id,question_id,rubric_id,value
sub_1,q1,r1,1
sub_1,q2,r2,excellent
sub_2,q1,r1,0`;
