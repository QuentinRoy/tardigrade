---
name: ui-styling
description: Mantine spacing and design-token conventions for this repo. Use whenever the user asks to add, fix, or adjust spacing, margin, padding, or gap between elements in a React/Mantine component (cramped fields, elements touching, too much whitespace, misaligned margins) -- even if they say "spacing" or "margin" without mentioning Mantine by name. Also use when writing or reviewing Mantine style props (`mb`, `p`, `gap`, ...) or a `style`/`styles`/`classNames` prop, a hardcoded pixel value (e.g. `marginTop: "13px"`, `width: "237px"`), or a PR/diff that touches component spacing or styling. Also use when writing or reviewing a component that applies `margin`/`mb`/`mt`/`my`, borderless/backgroundless `padding`, or page placement (`position: fixed`/`absolute`, `top`/`right`/`bottom`/`left`, overlay `zIndex`) to its own outermost element.
---

# UI styling

- Use vertical spacing in one direction only: prefer bottom spacing over top spacing.
  - In Mantine, use the `mb` style prop rather than `mt` or `my`.
  - When spacing multiple sibling elements, prefer `gap` on the parent container (`Stack`, `Group`, `Flex`) over margins on children.

- Prefer Mantine theme mechanisms and design-system tokens over custom styling where practical.
  - Reach for Mantine components, style props, theme tokens, responsive props, and the Styles API (`classNames`/`styles` with CSS modules) before ad-hoc inline `style`.

- Prefer Mantine spacing and design tokens over hard-coded pixel values.
  - Prefer style props (`p`, `px`, `py`, `mb`, `gap`) with spacing tokens (`"xs"`, `"sm"`, `"md"`, `"lg"`, `"xl"`) instead of arbitrary pixel values.
  - Prefer theme typography (`Text`, `Title`), colors, breakpoints, and sizing tokens when available.
  - Avoid exact pixel dimensions unless they represent a real fixed constraint (for example image dimensions, touch targets, canvas sizes, or third-party integration requirements).
  - Avoid arbitrary values such as `marginTop: "13px"` or `width: "237px"` when a theme-derived value would work.

## Examples

```tsx
// Bad: top margin, and a hardcoded pixel value.
<Box style={{ marginTop: "16px" }}>...</Box>

// Good: bottom spacing, theme token.
<Box mb="md">...</Box>
```

## Outer placement is the parent's responsibility

**Goal: a component owns how it looks inside its own boundary, never where it sits relative to anything outside that boundary.** Outer spacing *and* page placement are the parent's job. A component that decides its own position breaks encapsulation: it assumes a layout context it doesn't control, so every place that reuses it in a different context (a different sibling order, a grid instead of a stack, a different corner of the screen) needs a compensating override to undo it.

This covers two things on a component's outermost element:

- **Outer spacing.** Keep spacing inside the component's boundary. `padding` is fine on a root with a visible `border` or `background-color` — it's genuinely internal. But never `m`, `mt`, `mb`, `my`, or a hardcoded `margin` on the root, and never `padding` on a transparent/borderless root, which behaves identically to outer margin from the outside.
  - Let the parent control spacing between siblings, normally via `gap` on a flex/grid container (see "prefer `gap` over margins on children" above).
  - If a component is rendered inside something that does not support `gap` (e.g. plain text flow), the *call site* — not the component — adds the spacing, for example by wrapping the usage in a `Box` with `mb`.

- **Page placement.** Never put the component *itself* in a fixed/overlay position. No `position: "fixed"` / `"absolute"`, no `top`/`right`/`bottom`/`left` offsets, and no page-level overlay `zIndex` on the root. Where a toast, banner, or floating panel anchors on screen is the call site's decision; the component only renders its own content. Internal arrangement of the component's *own* children — `Flex`/`Stack`/`Group`, `gap`, `maxWidth` — stays inside the component, because that describes what's within its boundary, not where the boundary lands.
  - The call site that knows the layout context wraps the component to place it, e.g. `<Box pos="fixed" style={{ bottom: 16, left: 16, zIndex: 2000 }}><SaveErrorsDisplay /></Box>`.

```tsx
// Bad: RubricCard owns its own outer margin.
function RubricCard({ rubric }: RubricCardProps) {
	return (
		<Card mb="md">
			<Text>{rubric.title}</Text>
		</Card>
	);
}

// Every caller that doesn't want that margin has to compensate:
<RubricCard rubric={first} mb={0} /> // a compensating prop just to undo it
```

```tsx
// Good: RubricCard only manages its own internal spacing.
function RubricCard({ rubric }: RubricCardProps) {
	return (
		<Card>
			<Text>{rubric.title}</Text>
		</Card>
	);
}

// The parent that lays out multiple cards owns the spacing between them:
<Stack gap="md">
	{rubrics.map((rubric) => (
		<RubricCard key={rubric.id} rubric={rubric} />
	))}
</Stack>
```

```tsx
// Good: a one-off usage in prose, where the parent isn't a gap container,
// adds spacing at the call site instead of inside the component.
<Box mb="md">
	<RubricCard rubric={rubric} />
</Box>
```

```tsx
// Bad: borderless, backgroundless padding acts just like outer margin —
// it pushes siblings away even though there's no visible boundary to contain it.
function RubricCard({ rubric }: RubricCardProps) {
	return (
		<Box p="md">
			<Text>{rubric.title}</Text>
		</Box>
	);
}
```

```tsx
// Good: padding is fine once it's contained inside a visible boundary —
// it's genuinely internal spacing, not a stand-in for outer margin.
function RubricCard({ rubric }: RubricCardProps) {
	return (
		<Card p="md">
			<Text>{rubric.title}</Text>
		</Card>
	);
}
```
