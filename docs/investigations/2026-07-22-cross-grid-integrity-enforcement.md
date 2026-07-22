# Investigation: Enforcing cross-grid integrity on `criterion_grade`

- **Status:** Completed
- **Created:** 2026-07-22
- **Related:** [#144](https://github.com/QuentinRoy/tardigrade/issues/144)
- **Resolution:** Option A accepted and recorded in [ADR 0015](../adr/0015-enforce-cross-grid-integrity-with-composite-foreign-keys.md); executed via [plans/2026-07-22-cross-grid-integrity-enforcement.md](../../plans/2026-07-22-cross-grid-integrity-enforcement.md).

## Question

`criterion_grade` (the grade cell, the most-written table) references a
`criterion` and a `grade_target` through two independent foreign keys. Nothing
in the database forces those two parents to belong to the same `grid`: Postgres
will accept a cell whose criterion is in grid A and whose grade target is in
grid B. Only the application layer (`saveCriterionGradeInDb`) and defensive read
joins reject cross-grid combinations today.

Issue #144 proposes two ways to close this at the database level and asks us to
pick one:

- **(a)** re-introduce a replicated `grid_row_id` on `criterion_grade` and back
  it with composite foreign keys;
- **(b)** enforce it with a trigger instead, keeping the cell table narrow.

The owner is wary of replicated columns on principle, but flags that
`criterion_grade` is the hottest write table, so enforcement cost matters. This
investigation weighs (a), (b), and a third option, and recommends one.

Note: the sibling hazard on `criterion → rubric` is **not** in question — see
[Part 1](#part-1-criterion--rubric-not-contentious) below; it is free and should
ship regardless of which cell option is chosen.

## Current schema (relevant slice)

```
grid          row_id PK, id (Grid ID)
rubric        row_id PK, id, grid_row_id → grid
criterion     row_id PK, id, grid_row_id → grid, rubric_id → rubric(row_id)
grade_target  row_id PK, id, grid_row_id → grid
criterion_grade  id PK,
                 criterion_id        → criterion(row_id),
                 grade_target_row_id → grade_target(row_id),
                 UNIQUE (grade_target_row_id, criterion_id)   -- one cell per pair
                 -- NO grid_row_id
```

Facts that constrain the design space:

- **A `CHECK` constraint cannot reference other tables** in Postgres (no
  subqueries), so "CHECK-style guard" necessarily means a **trigger**.
- **A composite FK requires a `UNIQUE`/PK on the exact parent columns** it
  references. `row_id` is already each parent's PK, so a `UNIQUE (row_id,
  grid_row_id)` is trivially satisfiable and cheap — the same shape already used
  elsewhere (`criterion_grid_row_id_id_key`, `rubric_grid_row_id_id_key`).
- **A declarative FK can only compare columns that physically exist on the child
  row.** There is no way to make Postgres compare two *parents'* `grid_row_id`
  values without the child carrying the shared key itself. So a
  "declarative-but-no-new-column" solution for the cell does not exist: the
  realistic space is exactly {denormalized column + FK} vs {trigger} vs {no DB
  enforcement}.
- There is **exactly one write path** for `criterion_grade`:
  `saveCriterionGradeInDb` (`src/grade-persistence/gradeMutations.ts`). Bulk
  import (`src/imports/grades/saveGrades.ts`) routes every row through it, and it
  already resolves `grid.rowId` up front. So whichever option we pick, the
  writer already has the grid in hand.

## Part 1: `criterion → rubric` (not contentious)

`criterion` already carries both `rubric_id` and `grid_row_id`. Add:

- `UNIQUE (row_id, grid_row_id)` on `rubric` (trivially unique, cheap);
- composite FK `criterion (rubric_id, grid_row_id) REFERENCES rubric (row_id,
  grid_row_id)` (can replace the existing single-column `criterion.rubric_id`
  FK, which it subsumes).

No new column, no hot-path cost (`criterion` writes are rare), closes a real
hole. This should ship regardless of the cell decision below. The rest of this
document is only about the cell.

## Options considered (the `criterion_grade` cell)

### Option A — replicated `grid_row_id` + composite FKs

Add `grid_row_id` to `criterion_grade` and two composite FKs, both keyed on the
**same single column**:

- `criterion_grade (criterion_id, grid_row_id) REFERENCES criterion (row_id, grid_row_id)`
- `criterion_grade (grade_target_row_id, grid_row_id) REFERENCES grade_target (row_id, grid_row_id)`

backed by a cheap `UNIQUE (row_id, grid_row_id)` on each parent. One column,
double-duty: it forces `criterion.grid == grade_target.grid == criterion_grade.grid`.

**Pros**

- **Fully declarative and always-on.** Cross-grid rows become physically
  unrepresentable — the exact acceptance criterion #144 wants. No future write
  path or import bug can regress it.
- **Cheapest *enforced* option on the hot table.** An INSERT already performs two
  single-column FK checks; option A keeps two FK checks, now against composite
  unique indexes — essentially the same number of index probes. No per-row
  trigger invocation. This is the counter-intuitive but important point: on the
  busiest table, the replicated column is what *buys* low enforcement cost.
- **Uniform with the existing multi-tenant pattern** (`student`, `grade_target`,
  `criterion`, `rubric` all carry `grid_row_id`). Visible in the Kysely
  generated types, discoverable, one mental model.
- **Correctness is self-maintaining.** The writer must supply `grid_row_id`
  (it already has `grid.rowId`), and the composite FKs make a *wrong* value
  impossible to commit — the DB, not the app, guarantees the copy stays honest.
- Enables minor read simplifications (filter the cell by grid directly instead of
  always joining through `grade_target`).

**Cons**

- Adds a column (`int4`, 4 bytes/row) and at least one index to the largest,
  most-written table — partially reversing the "drop the assessment container"
  slimming.
- It is a **consistency copy**, not a true parent link. Under a strict
  "no replicated columns" reading it needs justification (the justification: it
  is the enforcement mechanism and the performant one — see recommendation).
- Every writer must now populate the column; a new hand-written insert that omits
  it fails loudly (NOT NULL) — safe, but one more thing to remember.

### Option B — trigger guard, no column

Keep `criterion_grade` narrow. Add a `BEFORE INSERT OR UPDATE` trigger that looks
up `criterion.grid_row_id` and `grade_target.grid_row_id` and raises if they
differ.

**Pros**

- No schema replication; the cell table stays lean, honoring the "no copies"
  instinct.
- DB-level enforcement (unlike Option C): still always-on regardless of write
  path.

**Cons**

- **Most expensive option on the hottest path.** The trigger fires per row and
  runs two extra lookups *plus* PL/pgSQL invocation overhead, on every single
  grade save and every imported row — precisely where write volume is highest.
  It pays *more* runtime than Option A to *avoid* a 4-byte column.
- **Invisible and harder to reason about.** Not in the Kysely types, not
  obvious from the schema; a hidden procedural guard is the classic
  "surprising trigger" maintenance trap.
- Trigger logic must be written, tested, and kept correct by hand — more surface
  than a declarative constraint the planner enforces for free.
- For this specific table it is arguably the worst of both worlds: it accepts
  hot-path runtime cost *and* gives up the clarity of a declarative constraint,
  in exchange only for not storing the column.

### Option C — Part 1 only; leave the cell to the app layer + tests

Ship Part 1 (free), but add **no** DB enforcement on `criterion_grade`. Rely on
the single write path (`saveCriterionGradeInDb`, which already resolves both the
criterion and the grade target by grid) plus integration tests that assert the
app rejects cross-grid saves.

**Pros**

- **Zero schema and zero runtime cost** — most faithful to "no replicated
  columns," keeps the hot table exactly as lean as it is now.
- Reflects reality: cross-grid cells are already impossible through the only
  write path, so there is no demonstrated bug.

**Cons**

- **Leaves #144's core acceptance criterion unmet.** The DB still accepts a
  cross-grid cell; safety depends on every future write path and import staying
  disciplined. Exactly the "app-layer-only" state the issue set out to fix.
- No defense-in-depth against raw SQL, migrations, or a future second writer.
- Tests would assert app behavior, not the DB-level guarantee #144 asks for.

## Comparison

| | A: column + composite FK | B: trigger | C: app-layer only |
|---|---|---|---|
| DB-level guarantee | Yes | Yes | **No** |
| Hot-path write cost | ~same as today (2 FK checks) | **Highest** (trigger + 2 lookups/row) | Zero |
| Replicated column | Yes (+4 bytes/row, +index) | No | No |
| Visible in schema/Kysely types | Yes | No (hidden) | n/a |
| Correctness maintained by | DB (self-checking) | Hand-written trigger | App code only |
| Meets #144 acceptance criteria | Yes | Yes | **No** |

## Recommendation

**Ship Part 1 unconditionally. For the cell, adopt Option A.**

The owner's instinct — "not a fan of replicated columns, but maybe it makes
sense to stay fast on the most-written table" — points the right way, and the
performance analysis inverts the usual intuition: here the replicated column is
**not** a cost paid for convenience, it is the *cheapest* way to get the
guarantee. Option A keeps write cost at roughly today's two FK checks, while
Option B — the "narrow" option — is the one that adds real per-row overhead on
the hottest table, buying nothing over A except the absence of one 4-byte
column. On this table that trade runs backwards.

Against Option A the only genuine objection is purity: `grid_row_id` on the cell
is a consistency copy, not a parent link. That objection is answered by writing
the justification down rather than avoiding the column:

- it is the **enforcement mechanism**, not a denormalized cache of convenience;
- it is the **lowest-runtime** enforcement available on the busiest table;
- it is **uniform** with every other grid-scoped table;
- its correctness is **guaranteed by the composite FKs**, so it cannot silently
  drift the way a hand-maintained copy would.

Per #144, document in `CONTEXT.md` (or alongside the schema) which `grid_row_id`
columns are **true parent links** (`student`, `grade_target`, `rubric`) versus
**consistency copies** enforced by composite FKs (`criterion`, and now
`criterion_grade`). That distinction is what makes the replicated column
principled rather than incidental.

Option C is the honest runner-up and the right choice *only if* the team decides
#144's DB-level guarantee is not worth any column at all — but that is choosing
not to do #144, so it should be an explicit descope, not a silent default.
Option B is not recommended: it is the most expensive option on the hot path and
the least visible, and its sole advantage over A (no column) is the thing that
makes it slower.

If the DB-level guarantee is wanted (the issue says it is), then **A**. If it is
not wanted, then **C** and close #144 as "won't fix at DB level" — but do not
reach for **B** to avoid a column while still paying, and paying more, at
runtime.

## Open questions

- Does `criterion_grade` need its own index on `grid_row_id`, or is the composite
  unique on the parents enough? The FK itself does not require a child index;
  add one only if a grid-scoped scan/delete of cells shows up in practice.
- Keep the existing single-column FKs alongside the composites, or replace them?
  The composites subsume them; replacing reduces index count but is a larger
  migration diff. Lean toward replacing for `criterion → rubric`, decide per
  benchmark for the cell.
- Which read-path defensive filters (`grades.ts`, `saveCriterionGradeInDb`)
  become redundant under A, and which stay because they also drive
  user-facing error messages rather than pure integrity?
