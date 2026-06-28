---
name: ui-styling
description: Material UI spacing and design-token conventions for this repo. Use whenever the user asks to add, fix, or adjust spacing, margin, padding, or gap between elements in a React/MUI component (cramped fields, elements touching, too much whitespace, misaligned margins) -- even if they say "spacing" or "margin" without mentioning MUI by name. Also use when writing or reviewing any `sx` prop, a hardcoded pixel value (e.g. `marginTop: "13px"`, `width: "237px"`), or a PR/diff that touches component spacing or styling.
---

# UI styling

- Use vertical spacing in one direction only: prefer bottom spacing over top spacing.
  - In Material UI, use `mb` rather than `mt` or `my`, including in `sx` props.
  - When spacing multiple sibling elements, prefer `gap` on the parent container over margins on children.

- Prefer Material UI theme mechanisms and design-system tokens over custom styling where practical.

- Prefer Material UI spacing and design tokens over hard-coded pixel values.
  - Prefer `p`, `px`, `py`, `mb`, `gap`, and `theme.spacing()` instead of arbitrary pixel values.
  - Prefer theme typography, palette, breakpoints, and sizing tokens when available.
  - Avoid exact pixel dimensions unless they represent a real fixed constraint (for example image dimensions, touch targets, canvas sizes, or third-party integration requirements).
  - Avoid arbitrary values such as `marginTop: "13px"` or `width: "237px"` when a theme-derived value would work.

## Examples

```tsx
// Bad: top margin, and a hardcoded pixel value.
<Box sx={{ mt: "16px" }}>...</Box>

// Good: bottom spacing, theme token.
<Box sx={{ mb: 2 }}>...</Box>
```
