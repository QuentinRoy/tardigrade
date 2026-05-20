# Testing conventions

Status: Current reference

This document records project-specific testing conventions that should remain stable across individual test files.

## User-facing error assertions

When tests cover user-visible errors, prefer plain-language assertions that include a clear recovery step, for example:

- reload and retry
- edit the input and retry
- report the issue if it persists

For critical save flows, keep integration coverage for these messages so regressions are caught when query scoping or validation rules change.

For future i18n support, avoid scattering one-off message strings across unrelated modules. Keep message ownership centralized per feature area so migration to translation keys is straightforward.
