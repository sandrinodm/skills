# The rules in full

The full text of the rules that SKILL.md summarizes, with their edge cases. Before/after examples
for most of them are in [patterns.md](patterns.md); the examples settle most judgment calls.

### 1. Vertical spacing: one blank line between steps, none inside a step

A function body is a sequence of steps. Separate the steps with exactly one blank line and keep
each step's lines together. Code without blank lines reads as one lump; code with a blank line
after every statement has no visible steps either.

- **After a block closes**, put a blank line when more code follows in the same block: after the
  `}` of an `if`, `for`, `while`, `switch` or `try`, including between two consecutive guard
  clauses. Not before `else`, `catch` or `finally`, and not before the enclosing block's own `}`.
- **A value and its check stay together**: no blank line between a declaration and the `if`,
  `for` or `switch` that tests or consumes it (`const output = …;` directly above
  `if (output === undefined)`, `let total = 0;` directly above the loop that adds to it).
- **A comment and its code stay together**: no blank line between a comment and the statement it
  describes.
- **A result and its return stay together**: no blank line between `const result = …` and the
  `return` that uses it, even when computing the value took several lines. The same goes for a
  table of test cases and the loop that runs them.
- Declarations that prepare the same step stay together; a new step (different data or purpose)
  starts after a blank line.
- Never two blank lines in a row, and never a blank line at the start or end of a block.
- **Check it mechanically before you finish.** Agents reliably over-apply "blank line between
  steps" and leave one between a value and its use. Look at every blank line you wrote: if the
  statement just below it uses a name declared in the statement just above it, delete the blank
  line. This catches `const delayMs = …;`, a blank line, then `if (delayMs !== undefined)`, and a
  table of test cases separated from the loop that runs them.

```ts
export function classifyFailure(provider: Provider, error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const output = failureOutput(error);
  if (output === undefined) {
    return providerFailure();
  }

  const classified = providers[provider].classify(output);
  // An unknown (502) error keeps the whole failed stream generic.
  if (classified?.status === 502) {
    return classified;
  }

  return classified ?? providerFailure();
}
```

Enforce the closing-brace part with a lint rule when the project's linter supports it (see
[formatter.md](formatter.md)). The other parts can't be linted, because a
rule can't tell a related statement from an unrelated one.

### 2. Name every magic number, pattern and repeated literal

`256 * 1024`, `300000`, `200`, `/^[0-9a-f-]{36}$/` and `['png', 'jpeg', 'webp']` mean nothing at
the call site. Give each a `SCREAMING_SNAKE` constant whose name says what it limits
(`MAX_CREDENTIAL_FILE_BYTES`, `TOKEN_REFRESH_MARGIN_MS`), with units in the name. Put limits
shared across modules in one module (for example `limits.ts`) and reuse them, including in error
messages: `` `Provide at most ${MAX_MESSAGE_PARTS} content parts per message.` `` stays correct when
the limit changes. Use a `Set` for membership lists, and name regexes.

Don't name values whose meaning is already obvious: `index + 1`, `length === 0`, HTTP statuses
passed to an error constructor.

Values that differ per environment (URLs, hosts, credentials) don't belong in source constants at
all: read them from configuration or secrets.

### 3. Give every error, message and check one home

Duplicated `new ApiError(400, 'invalid_x', 'Long message...')` calls drift apart. Build errors
through a catalog helper (`catalogError('invalid_x')`) or small named factories
(`loginRequired()`, `credentialsUnusable()`). The same goes for checks: if two functions validate
the same bound, extract `assertMessageCount()` and call it from both.

During a refactor, only swap in a shared helper when the existing status and message are
**identical** to what the helper produces. Otherwise the change is a behavior change.

### 4. Short functions, happy path top to bottom

A function that decodes three request shapes in one `if/else` chain with six `let` variables
declared up front should be three decoders that each return a value. Split when a function does
several things in sequence (validate, prepare, run, clean up): each step becomes a named helper and
the parent reads like a table of contents. Prefer early returns over nested `if`, and `switch` over
a chain of `endpoint === 'a' ? … : endpoint === 'b' ? …`.

Don't split a function just because it's long. A long, flat list of checks or fields is fine.

### 5. No nested ternaries, no long conditional-spread chains

```ts
// Before
const level = exit.ok ? 'info' : exit.cancelled ? 'warn' : exit.code === 'timeout' ? 'warn' : 'error';

// After
function logLevelFor(exit: Exit): LogLevel {
  if (exit.ok) {
    return 'info';
  }

  if (exit.cancelled || exit.code === 'timeout') {
    return 'warn';
  }

  return 'error';
}
```

Always brace `if` bodies and put them on their own lines (the `curly` lint rule); a one-line
`if (x) return y;` invites the classic bug of adding a second statement that runs unconditionally.

A single `...(value ? { value } : {})` is idiomatic with `exactOptionalPropertyTypes`; leave it.
When an object has three or more of them, or they're repeated across functions, extract a helper
(`imageMetadata(result)`, `withUpstream(config)`) that builds that part of the object.

### 6. Long conditions become a list of named checks

An `if` that joins many unrelated clauses, usually validation of several fields ending in one
generic error, hides which requirement failed. Split it into sequential checks, each failing with
a message that names the requirement (`'keep the connector filesystem read-only'`). Group related
checks under a one-line plain comment. A small assertion helper
(`requireCondition(condition, requirement): asserts condition`) keeps each check on one line.

- A long deny-list of forbidden fields usually collapses into one allowlist check
  (`Object.keys(connector).every((key) => ALLOWED_SETTINGS.has(key))`).
- Leave short conditions alone: two or three clauses about the same value
  (`!token || hasControlCharacters(token) || !TOKEN_PATTERN.test(token)`) read fine as one `if`.
- Per-requirement messages change the error text. In new code that's the point; in a readability
  pass, report it as an intended change.

### 7. Options objects instead of positional `undefined`

`responseObject(endpoint, model, result, undefined, undefined, effort)` hides what `effort` is.
Once a function has more than two optional parameters, or callers pass `undefined` to reach a later
one, take an options object: `responseObject(endpoint, model, result, { reasoningEffort })`.

Changing an exported function's parameters is an API change. In new code, design the options
object from the start. In a readability pass, convert internal functions freely, but for an
exported one keep the signature and propose the change in the report, unless the user chose
deeper restructuring. Then update every caller and say that the signature changed.

### 8. Use what the platform gives you; add nothing speculative

- Use the framework's own mechanism before writing one: its context or dependency injection
  instead of a hand-passed `Deps` object, its standard router instead of a home-made
  `defineOperation`, the official SDK or provided components instead of a hand-rolled client, the
  runtime's built-ins (Node, Effect platform modules) instead of a wrapper around a lower-level
  API.
- No pass-through layers. A function, module, worker or package that only forwards to another
  fails the deletion test (see [Deep modules](type-design.md#13-deep-modules)); inline
  it. Code with one consumer lives with that consumer.
- Don't force a generic abstraction over variants that really differ. Share the common part and
  let each variant own its details.
- Delete what nothing uses: fields, options, settings, dependencies, files, spikes.
- Before a release (no users, no stored data), don't add compatibility shims, legacy paths,
  migrations or output guarantees for the old shape. Change it cleanly.
- Names use the plain domain word (`caddy`, not `caddy-sites`) and avoid words that already mean
  something else to the team. Apply a rename everywhere at once (identifiers, files, folders,
  config, tests, docs) and leave no aliases.

### 9. Pipelines and Effect: name the steps, use Effect's own tools

Effect, RxJS and promise chains get unreadable when lambdas are nested several levels deep inside
`.pipe()` or `.then()`. Assign intermediate effects or promises to well-named constants, extract
repeated combinator sequences into a helper (for example `settled = (effect) =>
effect.pipe(Effect.uninterruptible, Effect.mapError(publicError))`). When code picks between two
pipelines, give the choice a name (`const copy = …`) and keep each branch to a call or two, or use
`if/else` or a helper. Never pipe straight off a parenthesized ternary of two multi-line chains.

Keep error types narrow. When extracting a helper widens an inferred error or return type (for
example to `unknown`), annotate the helper's return type rather than loosening the callers.

In Effect code, use Effect's own tools:

- Expected failures are tagged error classes in the error channel
  (`return yield* new FeedUnavailable({ url })`), never `throw new Error` inside `Effect.gen`.
  Defects stay defects.
- Log with `Effect.log*` and annotations, not `console`. Each log line has a human-readable
  message; details go in annotations.
- Use platform services (`FileSystem`, `Command`, `HttpClient`) instead of Node APIs wrapped in
  `Effect.tryPromise`. Keep `tryPromise` for third-party promise APIs, mapped to a typed error at
  the boundary.
- Dependencies are services provided through a `Layer`, not objects passed by hand.

### 10. Comments explain why, in plain English

- Keep comments that explain intent, constraints, security reasoning or a non-obvious ordering.
- Delete comments that restate the code.
- Rewrite telegraphic fragments ("Strict subset: knobs must not be silently ignored.") as plain
  sentences.
- No banner or separator comments (`// ── Data ──`, `// --- Notes ---`, `// ======`, `#region`).
  When the sections are separate concerns (data and workers, two unrelated tables), the file does
  several jobs: split it into modules named after them. When they only sort one concern's
  declarations by kind (Types, Queries, Helpers) in a file of reasonable size, delete the banners
  and keep the file, since splitting by kind groups code by file type. A one-sentence plain comment
  above a group of related statements inside a function is fine.
- Describe the code as it is. No references to plans, ADRs, tickets, phases, review rounds or
  agent sessions, and no dates or history words ("now", "no longer", "previously", "instead of the
  old …"). Keep the reasoning, drop the pointer: `// Per ADR-0007 we soft-delete` becomes
  `// Orders are soft-deleted so refunds can still read their history.`
- Every exported function, class, type and constant in new code gets a doc comment saying what
  it does, the units of its inputs, and what happens at the edges: invalid or missing input,
  values in the past, negative or out-of-range numbers, and what it throws or fails with. Put
  those notes on the export itself, not in a file header, a type elsewhere or a private helper,
  because editors show the export's comment on hover and that's where callers look.
- Write JSDoc by hand from what the code does and why: read the code, its tests and its git
  history. Never generate comments with a script, and never write placeholders that restate the
  name (`Gets the order.`) to satisfy a JSDoc linter.
- Mark deliberate shortcuts and known risks where they happen
  (`// Demo only: the decoded token is logged so the flow is visible. Never do this in
  production.`, `// The Management API is rate limited, so read app metadata once per request.`)
  rather than turning a demo shortcut into a config flag nobody will set.
- When you change code, fix the comments that describe it.
- Wrap comments at the formatter's line width; formatters don't wrap comments for you.
- Follow the project's JSDoc rules. If a linter requires multiline JSDoc on declarations, keep it.

### 11. Strings: readable source, identical output

Split long strings at sentence or clause boundaries with `+`, keeping the trailing space on the
first part. Build file contents from an array of lines joined with `'\n'` rather than one string
full of `\n`. Build long prompts from named parts. During a refactor, the bytes a user, client or
subprocess receives must not change. Prove it with `scripts/string-diff.mjs` (see the
verification script in SKILL.md).

### 12. Tests in a readability pass: light touch, deterministic timing

In a readability pass, don't rewrite assertions or rename tests (test names are what people grep
for). Do reformat minified fixture scripts into readable multi-line code, extract obvious repeated
fixtures, and name timeouts with a comment saying why the value was chosen. A fixture with a tight
deadline (for example 500 ms to spawn a process) will fail under full-suite load; give processes
that exit on their own generous headroom and keep short deadlines only for tests that deliberately
hit them. How new tests are laid out is in [files, folders and tests](structure.md).

### 13. Know what to leave alone

Leave these unchanged and say so in the report:

- Code that would need an import cycle to deduplicate.
- Subtle state machines (stream sinks, listener bookkeeping) where restructuring risks behavior.
  Extract helpers around them instead.
- Text embedded verbatim and executed elsewhere (scripts passed to child processes, SQL, templates
  compared byte for byte).
- Idiomatic one-liners that are already clear.
- Vendored code (shadcn/ui, ReUI and other copied registry components) and generated files (route
  trees, binding types, lockfiles). Change behavior at the call site or in a wrapper, never in the
  vendored file.
- Conventions the codebase already applies consistently (`Array<T>` versus `T[]`, `interface`
  versus `type`). Match them in new code; don't churn them in a readability pass. File names are
  the exception: PascalCase or camelCase files are renamed to kebab-case when the user chooses
  that in cleanup step 3 (the recommended answer), and listed as a recommendation when they don't.
- Type-level changes that alter runtime values or the public API (replacing an enum, adding
  brands, switching validation libraries, enabling new strict flags) unless the user chose
  deeper restructuring. List them in the report as recommendations instead.

Rewrites that look equivalent but change behavior on inputs the types forbid, which callers
still send:

| Original | Tempting rewrite | Differs when |
| --- | --- | --- |
| `a && a.b()` | `a?.b()` | `a` is `0`, `''` or `false` (the rewrite throws) |
| `x \|\| fallback` | `x ?? fallback` | `x` is `0`, `''` or `false` |
| `param ?? fallback` in the body | a default parameter | the caller passes `null` |
| `send(x).then(…)` | `await send(x)` | `send` returns a plain value instead of a promise |
| an index loop | `items.map(…)` | the array is sparse |

Keep the original form, or make the change and list it in the report as a behavior difference.
