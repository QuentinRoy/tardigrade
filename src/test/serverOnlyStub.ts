// Test stub for the `server-only` package.
//
// `server-only` exists to make a build fail if a server module is imported into a
// client bundle. Under Vitest's node environment there is no such bundler guard, and
// importing the real package is pointless noise that previously forced every test
// touching a server module to add `vi.mock("server-only", () => ({}))`. The Vitest
// config aliases `server-only` to this empty module so that side-effect import
// resolves to a no-op everywhere. See `docs/reference/testing-conventions.md`.
export {};
