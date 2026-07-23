# Use relationship keys for internal-only criterion and grade rows

- **Status:** Accepted
- **Created:** 2026-07-22
- **Related:** [ADR 0015](0015-enforce-cross-grid-integrity-with-composite-foreign-keys.md), [domain identifier glossary](../../CONTEXT.md), #322, #324

## Context

The data model distinguishes stable public identifiers (`id`) from generated,
internal database keys (`row_id`). Several internal-only tables predated that
convention and still had generated `id` columns.

Most of those columns came from Prisma's requirement that every model have a
single-column primary key. They did not represent independent identities:

- each criterion configuration row belongs one-to-one to a Criterion;
- each Criterion Grade is uniquely identified by its Grade Target and
  Criterion;
- each criterion-grade subtype row belongs one-to-one to that Criterion Grade.

Keeping a separate surrogate for those rows obscured their actual identity and
forced child rows to reference a generated value with no meaning outside the
relationship. It also left foreign-key columns containing internal row keys
named with `_id`, which made them look like public identifiers.

`options_criterion_mark` is different: one options Criterion can have many mark
rows, and its user-editable label is not a suitable primary key. A generated
internal key remains useful there.

## Decision

Use the existing relationship keys as the primary keys of these internal-only
rows:

- `check_criterion`, `number_criterion`, and `options_criterion` are keyed by
  `criterion_row_id`;
- `criterion_grade` is keyed by
  `(grade_target_row_id, criterion_row_id)`;
- `check_criterion_grade`, `number_criterion_grade`, and
  `options_criterion_grade` use that same composite key.

`options_criterion_mark` keeps a generated `row_id` because it has independent
one-to-many row identity and no suitable immutable natural key.

Every foreign-key column that stores an internal row key uses the `_row_id`
suffix. The `criterion_grade.grid_row_id` consistency copy and the composite
foreign keys established by ADR 0015 remain part of the model; changing the
grade cell's primary key does not weaken cross-grid integrity.

This decision is scoped to these criterion and grade tables. It is not a
general ban on surrogate keys: an internal row should keep a `row_id` when it
has independent identity or lacks a suitable stable natural key.

## Alternatives considered

- **Keep every surrogate and only rename it to `row_id`** — rejected because it
  would preserve meaningless identities and the extra indirection they impose.
  Consistent naming alone would not make the keys useful.
- **Key options marks by Criterion and label** — rejected because labels are
  user-editable data. Changing a label should not change a row's identity or
  every foreign key that may refer to it.

## Consequences

- Primary keys now express the one-to-one and association relationships already
  present in the model, and redundant generated values disappear.
- Criterion-grade subtype rows carry a two-column key instead of one surrogate
  value. Foreign keys and joins are wider, but writers already know both values
  and no longer need to retrieve an intermediate generated key.
- Internal key names consistently communicate the public-versus-persistence
  boundary defined in the domain glossary.
- Tables that later gain independent identity or lose a stable natural key may
  need a generated `row_id`; key choice remains driven by identity and
  cardinality.
- Public identifiers, domain concepts, and import/export contracts do not
  change.
