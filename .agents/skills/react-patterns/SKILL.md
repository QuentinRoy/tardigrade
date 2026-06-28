---
name: react-patterns
description: React/Next.js DOM-id (`useId`) and page-composition conventions for this repository, plus the "no outer margin or padding" rule for component spacing. Use whenever generating DOM ids for `aria-controls`/label pairs, deciding whether code belongs in an `app/` route file versus a reusable `src/` component, or writing/reviewing a component that applies `margin`/`mb`/`mt`/`my` or borderless/backgroundless `padding` (including in an `sx` prop) to its own outermost element.
---

# React patterns

## No outer margin or padding

A component must never apply outer spacing to its own outermost element: never `margin`, and never `padding` unless that element has a visible `border` or `background-color`. External spacing (the gap between a component and its siblings) is the parent's responsibility, not the component's. A component that sets its own outer margin — or padding on an otherwise invisible root, which behaves identically to margin from the outside — breaks encapsulation: it assumes a layout context it doesn't control, and every place that reuses it in a different context (a different sibling order, a grid instead of a stack) needs a compensating override to undo it.

- A component's root element should only carry spacing that's contained inside a visible boundary. `padding` is fine on an element with a `border` or `background-color` — it's genuinely internal. Never `m`, `mt`, `mb`, `my`, or a hardcoded `margin` on the root, and never `padding` on a transparent/borderless root.
- Let the parent control spacing between siblings, normally via `gap` on a flex/grid container (see `.agents/skills/ui-styling/SKILL.md`'s "prefer `gap` over margins on children").
- If a component is rendered inside something that does not support `gap` (e.g. plain text flow), the *call site* — not the component — adds the spacing, for example by wrapping the usage in a `Box` with `mb`.

```tsx
// Bad: SubmissionCard owns its own outer margin.
function SubmissionCard({ submission }: SubmissionCardProps) {
	return (
		<Card sx={{ mb: 2 }}>
			<CardContent>{submission.title}</CardContent>
		</Card>
	);
}

// Every caller that doesn't want that margin has to compensate:
<SubmissionCard submission={first} sx={{ mb: 0 }} /> // a compensating prop just to undo it
```

```tsx
// Good: SubmissionCard only manages its own internal spacing.
function SubmissionCard({ submission }: SubmissionCardProps) {
	return (
		<Card>
			<CardContent>{submission.title}</CardContent>
		</Card>
	);
}

// The parent that lays out multiple cards owns the spacing between them:
<Stack gap={2}>
	{submissions.map((submission) => (
		<SubmissionCard key={submission.id} submission={submission} />
	))}
</Stack>
```

```tsx
// Good: a one-off usage in prose, where the parent isn't a gap container,
// adds spacing at the call site instead of inside the component.
<Box sx={{ mb: 2 }}>
	<SubmissionCard submission={submission} />
</Box>
```

```tsx
// Bad: borderless, backgroundless padding acts just like outer margin —
// it pushes siblings away even though there's no visible boundary to contain it.
function SubmissionCard({ submission }: SubmissionCardProps) {
	return (
		<Box sx={{ p: 2 }}>
			<Typography>{submission.title}</Typography>
		</Box>
	);
}
```

```tsx
// Good: padding is fine once it's contained inside a visible boundary —
// it's genuinely internal spacing, not a stand-in for outer margin.
function SubmissionCard({ submission }: SubmissionCardProps) {
	return (
		<Card sx={{ p: 2 }}>
			<Typography>{submission.title}</Typography>
		</Card>
	);
}
```

## DOM IDs

- For elements that require DOM IDs, such as `aria-controls` / target `id` pairs or form inputs / labels, prefer React `useId()` over hard-coded global IDs to avoid collisions.
- Derived IDs are acceptable when multiple related IDs are needed, for example `${id}-name` and `${id}-email`.
- Do not use `useId()` for:
  - React list keys
  - database IDs
  - persisted identifiers
  - IDs that must remain stable across sessions

## Page composition

- Keep page-level composition in `app/` route files.
- Avoid `src/` components that are full pages; `src/` components should stay focused and independently reusable and testable.
