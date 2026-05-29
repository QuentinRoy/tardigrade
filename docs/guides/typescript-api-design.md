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

Avoid over-nesting. Named-object parameters should make the call site clearer, not create deep configuration shapes. Prefer the shallowest object that gives meaningful names to ambiguous arguments:

```ts
// Prefer
recordAssessment({
  submissionId,
  criterionId,
  score,
  comment,
});

// Avoid
recordAssessment({
  target: {
    submission: { id: submissionId },
    criterion: { id: criterionId },
  },
  value: {
    score,
    comment,
  },
});
```

Nest only when the nested value is a real domain concept, reusable shape, or boundary:

```ts
createQuestion({
  projectId,
  content: {
    title,
    prompt,
  },
  scoring: {
    maxPoints,
    rubric,
  },
});
```

Do not add wrapper objects such as `data`, `payload`, `params`, or `options` inside an already named parameter object unless they clarify a real distinction.

Before adding positional parameters, check whether the call site would still be clear if arguments were variables rather than literals. If not, use a named object.

This is a readability convention, not an absolute rule. Do not contort small local utilities, callbacks required by third-party APIs, or strongly conventional helpers just to satisfy it.