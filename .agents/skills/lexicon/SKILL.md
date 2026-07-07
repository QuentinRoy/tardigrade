---
name: lexicon
description: User-facing vocabulary conventions for this repository — the exact words used in UI labels, headings, button text, empty states, error messages, and export column headers, as recorded in docs/reference/lexicon.md. Use whenever writing or reviewing any user-facing string, naming a new UI concept, or choosing a label/heading/button/column-header word. Governs word choice (which term names a concept); for the tone and structure of error messages specifically, see the error-handling-ux skill.
---

# Lexicon

- Before writing new user-facing copy that names a concept, check `docs/reference/lexicon.md` for the preferred term.
- One concept gets one preferred term across the whole app. Never introduce a second word for a concept that already has an entry, and never reuse an existing user-facing word for a different concept.
- If the concept has no entry yet, add one to `docs/reference/lexicon.md` in the same change that introduces the copy, rather than inventing UI text ad hoc and leaving the lexicon stale.
- Prefer plain, jargon-free language. Don't surface internal/implementation terminology (table names, code identifiers, internal domain jargon from `CONTEXT.md` that a user wouldn't recognize) in user-facing copy — a Lexicon entry may deliberately differ from its `CONTEXT.md` counterpart; use the Lexicon term, not the `CONTEXT.md` term, in copy.
- If a `CONTEXT.md` domain term changes, check whether `docs/reference/lexicon.md` has a corresponding entry that needs updating too — the two are related but maintained independently, so a domain rename doesn't automatically update the user-facing word.
- This skill governs *which word* names a concept. For *how* to write an error message (tone, recovery path, jargon-free structure), see the `error-handling-ux` skill — the two are complementary, not overlapping: use this skill to pick the noun, that one to write the sentence around it.

## Example

```ts
// Bad: invents a new user-facing word ("assessment") for a concept that
// already has a decided lexicon entry ("grade"), and leaks an internal
// domain term ("rubric" meaning the whole grid) into copy about one item.
"Your assessment for this rubric wasn't saved.";

// Good: uses the lexicon's preferred terms.
"Your grade for this criterion wasn't saved.";
```
