# Files, folders and tests

How to name files, lay out folders and place tests. Use these for new code and new projects. In
an existing project, move files and folders only when the user asks. File names are different:
renaming them to kebab-case is a mechanical step that the cleanup workflow offers (and
recommends) on its own, with [a script](cleanup-workflow.md#renaming-files-to-kebab-case).

## Contents

1. [File names](#1-file-names)
2. [What goes in one file](#2-what-goes-in-one-file)
3. [Folders](#3-folders)
4. [`index.ts`](#4-indexts)
5. [Tests](#5-tests)
6. [Order inside a file](#6-order-inside-a-file)
7. [When a file becomes a folder](#7-when-a-file-becomes-a-folder)
8. [Imports and dependency direction](#8-imports-and-dependency-direction)
9. [Entry points and Effect services](#9-entry-points-and-effect-services)
10. [Example tree](#10-example-tree)

## 1. File names

- **kebab-case**, for React files too. The file name describes the module; the identifier inside
  keeps its own case.

  | File | Exports |
  | --- | --- |
  | `order-summary.tsx` | `export function OrderSummary()` |
  | `use-order-summary.ts` | `export function useOrderSummary()` |
  | `credential-schema.ts` | `export const CredentialSchema` |
  | `config.ts` | a single lowercase word needs no hyphen |

  Not `OrderSummary.tsx`, `useOrderSummary.ts` or `credentialSchema.ts`. kebab-case avoids
  case-only renames, which case-insensitive file systems (macOS, Windows) handle badly, and it
  reads the same in imports, URLs and shell commands.
- **Framework names win.** Route and convention files keep the names the framework needs:
  `__root.tsx`, `_layout.tsx`, `$id.tsx`, `[slug].tsx`, `+page.svelte`, `route.ts`. This is the
  only exception. A project that happens to use PascalCase component files isn't one, so a
  cleanup pass renames them unless the user chooses to keep them.
- **A dot suffix names the file's role**, so the base name stays the concept:
  `session.server.ts` (server-only code), `vite.config.ts`, `orders.types.ts`,
  `server.fixture.ts`, `orders.test.ts`.

## 2. What goes in one file

- One concern per file, named for it. `alchemy.run.ts` with `// ── Data ──` and `// ── Workers ──`
  sections becomes `infra/data.ts` and `infra/workers.ts`, composed by a short `alchemy.run.ts`.
- A schema per file when schemas are independent: `schemas/hotel.ts`, `schemas/booking.ts`, not
  one `schema.ts` with a banner per table.
- A type used by one file stays in it; see
  [where types live](type-design.md#11-where-types-live).

## 3. Folders

- **Group by domain concept**, not file type. Ask "what is this about?", not "what kind of file
  is it?":

  ```text
  accounts/                accounts/
    addresses/               services/
    sessions/                helpers/
    profile/                 utils/
  ```

  The left layout keeps a capability in one place, so changing it doesn't mean visiting several
  unrelated folders.
- **One folder per variant** when several implementations share a shape: `providers/codex/`,
  `providers/claude/`; `extensions/caddy/`, `extensions/cloudflare-tunnel/`; `sources/airbnb/`;
  `tools/` with one file per MCP tool. Code shared by every variant sits next to the variant
  folders (`providers/events.ts`).
- **Code with one consumer lives in that consumer.** Extract a package only when several apps use
  it. An empty app or worker that just calls a package is a pass-through; move the logic into it.
- **Vendored code in one place** (for example `packages/ui/src/components/`), so one ignore pattern
  covers it in the formatter, linter and JSDoc lint.
- **Apply a layout change everywhere.** When the convention changes (where e2e configs live, how
  providers are split), change every package and app, not just the one in front of you.

## 4. `index.ts`

`index.ts` is a folder's entry point:

- the module itself (`providers/codex/index.ts` is the Codex provider), or
- a short list of re-exports of the folder's public API.

Folders with no public API, such as a folder of tests or fixtures, don't get one. Don't build deep
re-export chains, where `index.ts` re-exports another folder's `index.ts`, which re-exports a
third: import from the folder that owns the code.

## 5. Tests

**Location.**

- Unit and integration tests sit beside the file they test: `orders.ts` and `orders.test.ts`.
  Use `.spec.ts` instead only if the project already does; don't mix the two.
- Not `__tests__/` or a top-level `tests/` folder. A test beside its file is found, moved and
  deleted with it.
- Variants of one subject get a dot suffix: `server.integration.test.ts`,
  `providers.contracts.test.ts`, `store.migration.test.ts`.

**Shape.**

- One `describe` per unit under test, one `it` per behavior.
- Name the behavior as a present-tense sentence: `it('rejects unreadable env files without
  leaking their contents')`, not `it('should reject…')` or `it('works')`.
- Use `it` consistently, not a mix of `it` and `test`.
- Test through the public interface, so a test breaks when behavior changes, not when the
  implementation does.

```ts
describe('readEnvFile', () => {
  it('parses quoted values and keeps inner spaces', async () => {
    const values = await readEnvFile(fixture('quoted.env'));
    expect(values.GREETING).toBe('hello world');
  });

  it('rejects unreadable env files without leaking their contents', async () => {
    const error = await readEnvFile(fixture('unreadable.env')).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(EnvFileError);
    expect(String(error)).not.toContain('SECRET');
  });
});
```

Tests follow the same spacing rule as production code: a value and the assertions on it stay
together, and a blank line separates setup steps (building fixtures, starting a server) from each
other.

**Fixtures.**

- A fixture used by one test file sits beside it as `name.fixture.ts`.
- Fixtures shared across a package live in its `testing/` folder and are exported from there.
- Exclude fixtures and tests from JSDoc lint.

**End-to-end tests** live in the app's `e2e/` folder, as `*.e2e.ts` or Playwright `*.spec.ts`:

```text
apps/webshop/
  e2e/
    checkout.e2e.ts
    config/          # runner configs, never at the package root
    support/         # page helpers, seeded users
```

## 6. Order inside a file

Write a file so it reads top-down, the way a reviewer opens it:

1. Imports.
2. Constants and limits.
3. Types and schemas.
4. The exported functions, classes or services: the file's interface.
5. Private helpers, in the order the exports call them.

Helpers written as `function` declarations can sit below their callers, because declarations are
hoisted. A helper written as a `const` arrow must come before its first use. Then keep the helpers
above the exports, still in call order.

Export only what another module imports. A helper exported only so a test can reach it means the
test is testing past the interface (see [deep modules](type-design.md#13-deep-modules)). Test it
through the export that uses it, or move it into its own module if it really stands alone.

## 7. When a file becomes a folder

Split a file when it holds several concerns, or when its private helpers outweigh its interface so
much that a reader has to scroll past them to find what the file offers. Turn `orders.ts` into a
folder with the same name:

```text
orders.ts              orders/
orders.test.ts           index.ts           # the public API, as before
                         pricing.ts         # private to orders/
                         pricing.test.ts
                         receipt.ts
                         orders.test.ts
```

The folder's `index.ts` keeps the file's exports, so only import paths change: `./orders.ts`
becomes `./orders/index.ts` under Node's ESM resolution, and `./orders` stays as it is under
bundler resolution. Files inside the folder are private to it by convention: nothing outside
`orders/` imports `orders/pricing.ts`. If something outside does need it, it's shared code and
belongs one level up.

Don't split a long file that does one thing: a flat list of routes, fields or checks is easier to
read in one place.

## 8. Imports and dependency direction

- **Import from the file that owns the code.** Inside a package, import the module directly
  (`./orders/pricing.ts`), not through the package's own `index.ts`. Barrel imports make the type
  checker, test runner and bundler load every re-exported module. Atlassian measured 30% faster
  type highlighting and 75% fewer build minutes per commit after removing them
  ([article](https://www.atlassian.com/blog/atlassian-engineering/faster-builds-when-removing-barrel-files)).
  A package's entry point (`package.json#exports`) is the one place where re-exporting is the
  point.
- **No `../../../` chains.** Use `package.json#imports` subpath aliases (`"#orders/*":
  "./src/orders/*"`), which Node, TypeScript and bundlers all resolve without extra config.
  tsconfig `paths` only works where a bundler or loader rewrites it; Node's own type stripping
  ignores tsconfig, so those imports fail at runtime.
- **`import type` for type-only imports**, enforced by `verbatimModuleSyntax`.
- **Dependencies point one way.** Features depend on shared code, never the other way round, and
  features don't import each other's private files. If two features need the same thing, move it
  to the nearest folder that contains both.
- **No import cycles.** A cycle means two modules are really one, or that a shared piece wants
  its own module. Catch cycles with `import/no-cycle` (eslint-plugin-import-x), oxlint's
  `import/no-cycle`, or dependency-cruiser in CI.

## 9. Entry points and Effect services

- **Entry points stay thin.** `main.ts`, `server.ts` or `worker.ts` read config, build the
  dependencies and start the program. Logic lives in the modules they wire together, where tests
  can reach it without starting a server.
- **One Effect service per file**, named for the service: `order-repository.ts` exports the
  `OrderRepository` service and its live `Layer`. A test layer goes beside it in
  `order-repository.fixture.ts`. The entry point composes the layers.
- **Errors live with the module that fails with them.** A tagged error used by one module is
  defined in it; errors shared across a feature go in that feature's `errors.ts`.
- **Schemas live at the boundary that decodes them**: a request schema beside its route handler,
  a config schema beside the config loader. The type derived from a schema sits next to it (see
  [Effect Schema](type-design.md#7-validate-untrusted-input-with-effect-schema)).

## 10. Example tree

```text
src/
  limits.ts
  protocol.ts
  protocol.test.ts
  server.ts
  server.integration.test.ts
  server.shutdown.fixture.ts
  providers/
    index.ts                      # picks a provider; shared dispatch
    events.ts                     # shared by every provider
    execution.ts
    execution.test.ts
    providers.contracts.test.ts
    codex/
      index.ts                    # the Codex provider
      credential-schema.ts
      credential-schema.test.ts
      usage.ts
    claude/
      index.ts
      claude.test.ts
apps/web/src/
  features/security/other-methods.tsx
  features/security/other-methods.test.tsx
  hooks/use-security-methods.ts
```
