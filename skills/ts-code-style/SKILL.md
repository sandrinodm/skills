---
name: ts-code-style
description: >-
  The user's TypeScript and JavaScript conventions: formatting, readability, type design,
  validation, tsconfig and project layout. TRIGGER: read this BEFORE opening any file, and don't
  skip it because the task looks routine. Use it whenever TS/JS work changes how code looks or is
  organized without adding features: cleaning up or restyling messy, cramped or AI-written code;
  splitting large functions or nested ternaries; fixing blank lines or spacing across files;
  quality reviews of a file, folder or PR; replacing enums; choosing type or interface; choosing a
  schema or validation library (Zod, Effect Schema); writing or tightening tsconfig; naming files
  and placing tests; writing new production TS. Several of these conventions break common defaults
  (no enums, Effect Schema over Zod), so generic answers will be wrong. SKIP: runtime bugs,
  profiling, explaining tsc errors, CI or lint pipelines, git history, UI features, other
  languages.
---

# TypeScript Code Style

Readable TypeScript is code a reviewer can follow on the first read: each function does one thing,
its steps are visibly separated, every number and message has a name or a single home, control
flow is visible instead of packed into expressions, and the types rule out states that can't
happen. Dense, AI-generated code fails the same handful of ways, so this skill names those failure
modes, gives the fix for each, and gives a workflow for fixing a whole codebase without changing
its behavior.

## What to read for the task

This file is the checklist. Read a reference only when the task needs it:

| Task | Follow | Read |
| --- | --- | --- |
| Review code | [The rules](#the-rules), plus types and files for design findings | [rules.md](references/rules.md) when a finding is a judgment call |
| Write new code | The rules, [types](#types-and-boundaries), [files](#files-folders-and-tests) | [type-design.md](references/type-design.md) for schemas, tsconfig and errors; [structure.md](references/structure.md) for a new project or feature |
| Change a few files | The rules, matching the neighbouring code | Nothing extra |
| Readability pass over a codebase | [Cleanup workflow](#cleanup-workflow) | [cleanup-workflow.md](references/cleanup-workflow.md), [patterns.md](references/patterns.md), [formatter.md](references/formatter.md) |
| Question about types, tsconfig or validation | [Types and boundaries](#types-and-boundaries) | [type-design.md](references/type-design.md) |
| Question about files, folders or tests | [Files, folders and tests](#files-folders-and-tests) | [structure.md](references/structure.md) |

**Reviews** rank findings by how much they hurt comprehension and cite each one as `path:line`.
For the biggest findings, show the current code next to the proposed code. Measure anything you
quote (line lengths, counts) instead of estimating it, and skip idiomatic one-offs.

**Changing a few files**: restyle only the files you touch, match how their neighbours are written,
then run the project's checks (format, lint, JSDoc lint, typecheck, tests).

Don't write these rules into the project's README or docs unless the user asks. The formatter and
lint config are the project's style documentation.

## The rules

Each rule's full text and edge cases are in [references/rules.md](references/rules.md), and
before/after examples are in [references/patterns.md](references/patterns.md).

1. **One blank line between steps, none inside a step.** Put a blank line after a closing `}` when
   more code follows in the same block, including between guard clauses (not before `else`,
   `catch`, `finally` or the enclosing `}`). Keep a value with the `if`, loop or `return` that
   uses it, even when computing it took several lines: no blank line between `const tax = …` and
   `return { …, tax }`, or between a table of test cases and the loop over them. Keep a comment
   with its code. Never two blank lines in a row, or a blank line at the start or end of a block.
   Before you finish, check every blank line you wrote: if the statement just below it uses a
   name declared in the statement just above it, delete the blank line.
2. **Name every magic number, pattern and repeated literal** as a `SCREAMING_SNAKE` constant with
   units (`MAX_CREDENTIAL_FILE_BYTES`, `TOKEN_REFRESH_MARGIN_MS`): limits, prices, rates, retry
   counts and delays, coupon values. Interpolate limits into their error messages. Use a `Set`
   for membership lists, and name regexes. Leave obvious values alone (`index + 1`), and read
   per-environment values from configuration.
3. **One home for every error, message and check.** Build errors through small factories
   (`loginRequired()`) or a catalog helper, not repeated `new ApiError(400, …)` calls; a shared
   message constant isn't enough. Extract a check used twice. In a refactor, swap in a helper only
   when its status and message are identical.
4. **Short functions, happy path top to bottom.** Split a function that does several things in
   sequence into named steps, so the parent reads like a table of contents. Prefer early returns
   and `switch`. A long, flat list of checks or fields is fine as it is.
5. **No nested ternaries; braced `if` bodies on their own lines.** Replace a nested ternary with a
   small function using early returns. Three or more conditional spreads in one object become a
   helper that builds that part; a single one is idiomatic.
6. **Long conditions become a list of named checks**, each failing with a message that names the
   requirement. A long deny-list usually becomes one allowlist check. Two or three clauses about
   one value are fine as one `if`.
7. **Options objects instead of positional `undefined`** once a function has more than two
   optional parameters or callers pass `undefined` to reach one. Changing an exported signature
   is an API change: in a readability pass, keep exported signatures and propose the change in
   the report, unless the user chose deeper restructuring.
8. **Use what the platform gives you; add nothing speculative.** Prefer the framework's dependency
   injection, router, SDK and runtime built-ins over home-made versions. Inline pass-through
   layers, delete what nothing uses, and before a release skip compatibility shims. Use the plain
   domain word for names, and rename everywhere at once.
9. **Name the steps of pipelines, and use Effect's own tools.** Assign intermediate effects and
   promises to named constants; never pipe off a ternary of two multi-line chains. Keep error types
   narrow by annotating helpers. In Effect code: tagged errors in the error channel instead of
   `throw`, `Effect.log*` instead of `console`, platform services instead of wrapped Node APIs,
   and dependencies as services provided through a `Layer`.
10. **Comments explain why, in plain English.** Delete comments that restate the code, rewrite
    telegraphic fragments as sentences, and use no banner or separator comments (a file that needs
    them is several files). No references to plans, tickets, sessions or history ("now", "no
    longer"). Every exported function, class, type and constant in new code gets a hand-written
    doc comment covering what it does, units, and what it does with invalid, missing or
    out-of-range input, including what it throws. Put that on the export itself.
11. **Readable strings, identical output.** Split long strings at clause boundaries, build file
    contents from an array of lines, and in a refactor keep every byte the user, client or
    subprocess receives. Prove it with the [verification script](#verification-script).
12. **Tests in a readability pass**: don't rewrite assertions or rename tests. Reformat minified
    fixtures, extract repeated fixtures, and give timing-sensitive fixtures generous headroom.
13. **Know what to leave alone**, and say so in the report: code that would need an import cycle to
    deduplicate, subtle state machines, text executed elsewhere (SQL, child-process scripts),
    vendored and generated files, conventions the codebase applies consistently, and type-level or
    API changes (enums, brands, validation libraries, strict flags) unless the user chose deeper
    restructuring.
    In a refactor, watch for rewrites that look equivalent but aren't: `a && a.b()` versus
    `a?.b()` and `||` versus `??` (they differ for `0`, `''` and `false`), default parameters
    versus `??` (they differ for `null`), and `.then()` versus `await` (they differ for a value
    that isn't a promise). Keep the original form or report the difference.

## Types and boundaries

Details, examples and sources (mostly Matt Pocock's
[Total TypeScript](https://www.totaltypescript.com/) articles) are in
[references/type-design.md](references/type-design.md).

- **Strict compiler**: `strict`, `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `verbatimModuleSyntax`, `isolatedModules` and, on TypeScript 5.8+, `erasableSyntaxOnly`.
- **`type` by default**; `interface ... extends` only when one object type builds on another.
- **Discriminated unions instead of a bag of optionals**, handled with an exhaustive `switch`.
- **No enums**: string-literal unions, or an `as const` object plus a derived union.
- **Property syntax for function members** (`save: (order: Order) => Promise<void>`), never method
  shorthand or the `Function` type.
- **No `any`**: outside data is `unknown` until decoded. Prefer `satisfies` to `as`.
- **Validate untrusted input with Effect Schema, not Zod.** In a codebase that uses Effect, always
  use `Schema` from `effect` and never add Zod. In a new project or one with no validation library,
  add `effect` and use Schema, which works without the rest of Effect
  (`Schema.decodeUnknownSync`). Keep Zod only where an existing codebase already standardized on
  it. Derive types from schemas (`typeof X.Type`) and decode with the `decodeUnknown*` functions.
  A schema is for structured input (JSON bodies, config, messages); a single header or flag with
  a fixed grammar needs only a small, well-tested parser.
- **Brand validated primitives** that are easy to mix up or security-relevant (`UserId`, `Email`).
- **Declare return types on exported top-level functions**, including `Effect.Effect<A, E, R>`.
- **Deep modules**: a small interface over a lot of behavior. Inject dependencies, return results
  instead of mutating, and add a seam only when two implementations exist.

## Files, folders and tests

Details and an example tree are in [references/structure.md](references/structure.md).

- **kebab-case file and folder names**, React included (`order-summary.tsx` exports
  `OrderSummary`), except names a framework requires or a convention the project already uses.
  Dot suffixes name a file's role: `.server.ts`, `.types.ts`, `.fixture.ts`, `.test.ts`.
- **Group by domain concept, not file type**: `orders/`, `refunds/`, not `services/`, `utils/`.
  One concern per file; one folder per variant (provider, source, tool). Code with one consumer
  lives in that consumer, and a type used by one file stays in it (shared types go in a
  `*.types.ts` in the smallest folder that covers every user). Apply a layout change to every
  package at once.
- **Tests beside the file they test** (`orders.ts`, `orders.test.ts`), never in `__tests__/` or a
  top-level `tests/`. One `describe` per unit, one `it` per behavior, named as a present-tense
  sentence. End-to-end tests live in the app's `e2e/` folder.
- **Top-down files**: imports, constants, types, the exports, then private helpers in call order.
  Export only what other modules import. A file that outgrows itself becomes a same-named folder
  whose `index.ts` keeps its exports.
- **Imports**: from the file that owns the code, not through your own package's `index.ts`
  barrels; `package.json#imports` aliases (`#orders/*`) instead of `../../../`. Dependencies point
  one way, with no import cycles.
- **Thin entry points**: `main.ts` reads config, composes services and `Layer`s and starts the
  program. In Effect, one service per file (`order-repository.ts` with its live `Layer`).

## Formatter

When formatted code still feels dense, check spacing first (rules 1 and 5), then the line width.
**100 columns** is the recommended width for new projects and cleanup passes; keep an existing
project's width unless the user agrees to change it. When the project has a formatter or linter,
enforce what it can (braces, blank line after a block, import order, JSDoc) through its config.
Don't install new tooling for a small change unless the user asks; recommend it instead. The
recommended tooling is Vite+ (oxfmt and oxlint, run by `vp check`). Fix lint findings rather than
adding disable comments or exclusions. The Vite+ config and the matching lint rules are in
[references/formatter.md](references/formatter.md).

## Cleanup workflow

For a readability pass over an existing codebase, follow
[references/cleanup-workflow.md](references/cleanup-workflow.md):

1. **Baseline**: run typecheck, lint and tests and record the exact results.
2. **Snapshot** the working tree into a scratch directory. Never stash, reset or commit the user's
   work unasked.
3. **Ask** about line width (100 recommended) and depth (cosmetic, readability refactors
   (recommended), or deeper restructuring), or state the defaults you chose.
4. **Mechanical pass**: formatter config and a format run, then checkpoint a copy of the tree.
5. **Hand pass**: apply the rules file by file, reading each file fully first.
6. **Verify**: rerun every check with real exit codes, run the original tests against the new code,
   run the string-diff script, and probe edge cases (`null` arguments, empty lists, non-promise
   callbacks) on the old and new code.
7. **Report** against the baseline ("7/7 tests passed before and after"): the substantive changes,
   **every** observable behavior difference however small (or that you checked and found none),
   what you left alone and why, what couldn't run, and where the snapshots are. Offer a commit
   instead of making one.

## Verification script

`scripts/string-diff.mjs` compares the string literals in two source trees, so you can prove that
error messages, CLI output and prompts survived a refactor. It joins literals concatenated with
`+`, and keeps template expressions so a literal replaced by a constant shows up for review.

```bash
node scripts/string-diff.mjs ../before ./                # source files, user-facing strings
node scripts/string-diff.mjs ../before ./ --tests --all  # also tests, and every literal
```

It exits with status 1 when the trees differ. Explain every difference before the pass is done.
