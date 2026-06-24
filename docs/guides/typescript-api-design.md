# TypeScript API design

Favor function signatures that stay readable at the call site and remain consistent as APIs evolve.

## Function parameters

Use positional parameters when the function has one obvious argument and the function is unlikely to grow additional domain parameters:

```ts
getProject(projectId);
parseCsv(source);
renderQuestion(question, { showRubric: true });
```

Small conventional helpers may also use positional parameters when the order is widely understood and the call site remains clear:

```ts
clamp(value, min, max);
replaceText(text, search, replacement);
```

Prefer a named object for domain actions, mutations, exported helpers, and functions likely to be reused or extended, even when there is currently only one domain argument:

```ts
deleteQuestion({ questionId });
archiveProject({ projectId });
createAssessment({ submissionId });
recomputeGrades({ projectId });
```

This avoids future breaking changes when the API grows, and keeps related functions consistent:

```ts
// Prefer a consistent family of domain actions
createQuestion({ projectId, title, prompt });
updateQuestion({ questionId, title, prompt });
deleteQuestion({ questionId });

// Avoid mixing styles in the same API family
createQuestion({ projectId, title, prompt });
updateQuestion({ questionId, title, prompt });
deleteQuestion(questionId);
```

Use positional parameters for a single argument only when the argument is genuinely the value being transformed, fetched, parsed, or rendered, and not just one named field of a domain command:

```ts
// Fine
parseCsv(source);
normalizeStudentId(rawId);
renderQuestion(question);

// Prefer object
deleteQuestion({ questionId });
assignReviewer({ submissionId, reviewerId });
moveQuestion({ fromIndex, toIndex });
```

Prefer a named object when the call site would otherwise require remembering parameter order:

```ts
moveQuestion({ fromIndex, toIndex });
assignReviewer({ submissionId, reviewerId });
recordAssessment({ submissionId, criterionId, score });
copyRubricItem({ sourceItemId, targetRubricId });
```

Also prefer objects when arguments include booleans, optional values, or multiple values with the same primitive type.

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

Use one primary positional argument plus an options object when the first argument is the main value and the rest are secondary modifiers:

```ts
renderQuestion(question, { showRubric: true });
fetchSubmissions(projectId, { includeArchived: false });
```

But if the function is a domain command or mutation, prefer putting all domain inputs in the named object instead of mixing positional and named parameters:

```ts
// Prefer
updateQuestion({
	questionId,
	patch,
});

// Avoid
updateQuestion(questionId, { patch });
```

## Leading execution context

A required execution context or dependency may be a leading positional parameter when it is conventional and consistent within a layer:

```ts
saveQuestionsInDb(db, { questions, projectId });
saveStudentsInDb(db, { students, projectId });
deleteProjectFromDb(db, { projectId });
recomputeGradesInDb(db, { projectId });
```

In this pattern, the leading positional argument is not considered part of the domain command. Domain inputs should still be grouped in a named object.

Use this convention only for stable, cross-cutting dependencies such as a database handle, transaction, request context, or logger when the surrounding API family consistently uses the same style. Do not use it as a reason to add multiple positional domain arguments after the dependency:

```ts
// Avoid
saveQuestionsInDb(db, questions, projectId);

// Prefer
saveQuestionsInDb(db, { questions, projectId });
```

This also keeps transaction usage straightforward:

```ts
await db.transaction().execute(async (tx) => {
	await saveQuestionsInDb(tx, { questions, projectId });
	await recomputeGradesInDb(tx, { projectId });
});
```

## Object shape

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

## Exceptions

Before adding positional parameters, check whether the call site would still be clear if arguments were variables rather than literals. Also check nearby functions in the same API family. If related functions use named objects, keep the same style unless there is a strong reason not to.

This is a readability convention, not an absolute rule. Do not contort small local utilities, callbacks required by third-party APIs, or strongly conventional helpers just to satisfy it.

## Type assertions

Avoid `as` type assertions; prefer type guards, generics, `satisfies`, or narrowing. The `lint/plugin/no-type-assertion` Biome rule enforces this.

A `biome-ignore lint/plugin/no-type-assertion` with an explanatory comment is an accepted escape hatch when removing the assertion would mean going noticeably out of the way relative to the value gained. The rule exists to keep `as` deliberate and its rationale explicit, not to force a workaround at any cost; it is not held to the same strict bar as other lint rules.

Most of the time a small change to the types or the control flow removes the need for an assertion.

Narrow instead of asserting away a case the compiler is unsure about. Here `find` returns `User | undefined`, and `as User` papers over the `undefined`, so a missing user becomes a crash on `.name` instead of a handled error:

```ts
type User = { id: string; name: string };

// Avoid: assert the result is a User, discarding the undefined case
function getUserName(users: User[], userId: string) {
	const user = users.find((user) => user.id === userId) as User;
	return user.name;
}

// Prefer: handle undefined, after which `user` is a User with no assertion
function getUserName(users: User[], userId: string) {
	const user = users.find((user) => user.id === userId);
	if (user === undefined) {
		throw new Error(`User not found: ${userId}`);
	}
	return user.name;
}
```

Or model the data so the mismatch never arises. Keeping `type` and `value` separate forces an `as keyof` lookup and an `as never` call to get past their unrelated types; a discriminated union pairs them, and every branch type-checks on its own:

```ts
// Avoid: `type` and `value` are independent, so both the lookup and the call
// need assertions to compile
const handlers = {
	text: (value: string) => value.trim(),
	number: (value: number) => value.toFixed(2),
	boolean: (value: boolean) => (value ? "yes" : "no"),
};
function formatField(type: string, value: unknown) {
	const handler = handlers[type as keyof typeof handlers];
	if (handler === undefined) {
		throw new Error(`Unknown field type: ${type}`);
	}
	return handler(value as never);
}

// Prefer: one union ties each type to its value, so each branch is checked
type Field =
	| { type: "text"; value: string }
	| { type: "number"; value: number }
	| { type: "boolean"; value: boolean };
function formatField(field: Field) {
	switch (field.type) {
		case "text":
			return field.value.trim();
		case "number":
			return field.value.toFixed(2);
		case "boolean":
			return field.value ? "yes" : "no";
	}
}
```

Use a justified `biome-ignore` only when the invariant is real but the type system cannot express it:

```ts
// Acceptable: `.map()` preserves array length, so the result still matches the
// fixed-length tuple type, but the generic signature of `.map()` can't prove it.
// biome-ignore lint/plugin/no-type-assertion: `.map()` preserves array length.
type InputTuple = readonly [Input, Input];
type OutputTuple = readonly [Output, Output];
const inputs: InputTuple = getInputs();
return inputs.map(process) as OutputTuple;
```