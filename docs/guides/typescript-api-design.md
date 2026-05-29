# TypeScript API design

Favor function signatures that stay readable at the call site.

## Function parameters

Use positional parameters when the function has one obvious argument, or when there is one primary argument plus a secondary options object:

```ts
getProject(projectId);
parseCsv(source);
renderQuestion(question, { showRubric: true });
fetchSubmissions(projectId, { includeArchived: false });
```

Small conventional helpers may also use positional parameters when the order is widely understood and the call site remains clear:

```ts
clamp(value, min, max);
replaceText(text, search, replacement);
```

Prefer a named object when the call site would otherwise require remembering parameter order:

```ts
moveQuestion({ fromIndex, toIndex });
assignReviewer({ submissionId, reviewerId });
recordAssessment({ submissionId, criterionId, score });
copyRubricItem({ sourceItemId, targetRubricId });
```

Use a named object for domain actions, mutations, exported helpers, and functions likely to be reused or extended. Also prefer objects when arguments include booleans, optional values, or multiple values with the same primitive type.

Avoid positional booleans:

```ts
// Avoid
renderQuestion(question, true);

// Prefer
renderQuestion(question, { readOnly: true });
```

Avoid ambiguous same-type positional pairs:

```ts
// Avoid
assignReviewer(submissionId, reviewerId);
transferAssessment(sourceProjectId, targetProjectId);

// Prefer
assignReviewer({ submissionId, reviewerId });
transferAssessment({ sourceProjectId, targetProjectId });
```

Before adding positional parameters, check whether the call site would still be clear if arguments were variables rather than literals. If not, use a named object.

This is a readability convention, not an absolute rule. Do not contort small local utilities, callbacks required by third-party APIs, or strongly conventional helpers just to satisfy it.