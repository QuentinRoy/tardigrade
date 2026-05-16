# Export Questions as YAML Plan

## Overview
Create an export questions functionality that produces YAML compatible with the existing import questions feature. Default values are already stored in the database, so they're automatically included in the export.

## Requirements
- Export questions in YAML format that can be imported back via the existing import feature
- Serialize what's already in the database (defaults are applied during import and stored)
- Ensure round-trip compatibility: export → import → export should produce identical YAML

## Implementation Strategy

### 1. Create Core Export Function
**File:** `src/export/questionsExport.ts`
- `exportQuestionsToYaml(questions: Grid): string` - main export function
- Takes loaded questions data structure and converts to YAML
- Serializes as-is (defaults are already in the database from previous imports)

### 2. Add UI Export Menu Item
**File:** `src/export/ExportCsvMenu.tsx`
- Add "Export Questions" menu item alongside existing CSV export options
- Download YAML file with timestamp: `questions-export-YYYY-MM-DD.yaml`

### 3. Create Route Handler
**File:** `app/export/questions/route.ts`
- Server-side route that fetches questions and returns YAML file
- Triggered by the export menu item

### 4. Add to Navigation
**File:** `src/shared/AppShell.tsx`
- Update EXPORT_ITEMS or add export questions option

## YAML Output Format Example
```yaml
questions:
  - id: q1
    label: Question 1
    rubrics:
      - id: r1
        label: Correctness
        description: "This thing is either correct or not."
        type: boolean
        marks: 2
        falseMarks: 0

      - id: r2
        label: Style
        description: "This thing is about the style."
        type: ordinal
        marks:
          excellent: 2
          good: 1
          poor: 0

      - id: r3
        label: Score
        description: "This thing is about the score."
        type: numerical
        minScore: 0
        maxScore: 10
        minMarks: 0
        maxMarks: 5
        reversed: false
```

## Files to Create/Modify
- **Create:** `src/export/questionsExport.ts` - Core export logic
- **Create:** `app/export/questions/route.ts` - API route handler
- **Modify:** `src/export/ExportCsvMenu.tsx` - Add UI menu item
- **Modify:** `src/shared/AppShell.tsx` - Add navigation item (optional)
- **Create:** `src/export/questionsExport.test.ts` - Unit tests (optional)

## Default Values Reference
From import schemas validation:
- Numerical rubrics: minScore=0, maxScore=1, minMarks=0, maxMarks=0, reversed=false
- Boolean rubrics: falseMarks=0
- Optional fields: description and label always included (as empty string if not set)
