# Before and after

Each pattern below comes from a real readability pass over a TypeScript service (an Effect-based
HTTP gateway) whose code was mostly written by an AI coding agent. The "before" code passed the
formatter, typecheck and lint, and was still hard to read.

## Contents

1. [Magic numbers become named limits](#1-magic-numbers-become-named-limits)
2. [Repeated errors become a catalog helper](#2-repeated-errors-become-a-catalog-helper)
3. [One check, one helper](#3-one-check-one-helper)
4. [A block of `let`s becomes one decoder per variant](#4-a-block-of-lets-becomes-one-decoder-per-variant)
5. [Nested ternaries become small functions](#5-nested-ternaries-become-small-functions)
6. [Conditional spreads become builders](#6-conditional-spreads-become-builders)
7. [Positional `undefined` becomes an options object](#7-positional-undefined-becomes-an-options-object)
8. [Ternaries between pipelines become named steps](#8-ternaries-between-pipelines-become-named-steps)
9. [Long sequential functions become a table of contents](#9-long-sequential-functions-become-a-table-of-contents)
10. [Long strings and file contents](#10-long-strings-and-file-contents)
11. [Inferred types that widen](#11-inferred-types-that-widen)
12. [Comments](#12-comments)
13. [Test timing](#13-test-timing)
14. [Things that looked wrong but stayed](#14-things-that-looked-wrong-but-stayed)
15. [Lumped-together code gets blank lines between steps](#15-lumped-together-code-gets-blank-lines-between-steps)
16. [A long condition becomes a list of named checks](#16-a-long-condition-becomes-a-list-of-named-checks)
17. [Banner comments become files](#17-banner-comments-become-files)
18. [Comments that point at plans and history](#18-comments-that-point-at-plans-and-history)
19. [Home-made wrappers become the framework's mechanism](#19-home-made-wrappers-become-the-frameworks-mechanism)
20. [Thrown errors and console logs in Effect code](#20-thrown-errors-and-console-logs-in-effect-code)

Sections 15 to 20 come from a developer's corrections to agent-written code across several
projects (a deploy CLI, an API gateway, an auth reference app), not from the single pass that
produced sections 1 to 14.

## 1. Magic numbers become named limits

```ts
// Before: the same numbers in several files, meaning nothing at the call site
const bytes = yield* safeRead(file, 256 * 1024);
if (expiresAt - Date.now() < 300000) { … }
if (messages.length === 0 || messages.length > 200) { … }
if (result.images.length > 4 || (result.imageSize?.length ?? 0) > 9) { … }
```

```ts
// After: limits.ts (shared) or the top of the one module that uses them
/**
 * Credential files are small JSON documents; anything larger is not a credential file.
 */
export const MAX_CREDENTIAL_FILE_BYTES = 256 * 1024;

/**
 * Refresh tokens this long before they expire so they outlive the job that uses them.
 */
export const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export const MAX_MESSAGES = 200;
export const MAX_IMAGES_PER_REQUEST = 4;
```

Notes:

- Put the unit in the name (`_BYTES`, `_MS`) and write the value in the unit's natural arithmetic
  (`5 * 60 * 1000`, not `300000`).
- Interpolate the constant into messages that mention it:
  `` `Provide at most ${MAX_MESSAGE_PARTS} content parts per message.` ``. The rendered text is
  unchanged today and stays right when the limit moves.
- Binary formats deserve names too: a PNG parser's `57`, `12`, `13` became `MIN_PNG_BYTES`,
  `CHUNK_OVERHEAD`, `IHDR_LENGTH`; SQLite's `5`/`6` became `SQLITE_BUSY`/`SQLITE_LOCKED`.
- Lists used for membership become `Set`s with a name (`quotaErrorTypes`,
  `failureResultSubtypes`); regexes get a name (`THREAD_ID_PATTERN`) and, if tested in more than
  one place, a predicate (`isThreadId()`).

## 2. Repeated errors become a catalog helper

```ts
// Before: the same status, code and message typed out in five files
throw new ApiError(
  400,
  'invalid_image_reference',
  'Use at most five bounded PNG, JPEG or WebP reference images.',
);
```

```ts
// After: one catalog entry, one helper
export function catalogError(
  code: ApiErrorCode,
  options: { readonly status?: number; readonly param?: string } = {},
): ApiError {
  const definition = apiErrorCatalog[code];
  return new ApiError(
    options.status ?? definition.statuses[0]!,
    code,
    definition.message,
    options.param ?? null,
  );
}

throw catalogError('invalid_image_reference');
```

When there is no catalog, small named factories do the same job inside a module family:
`loginRequired()`, `credentialStorageUnavailable()`, `credentialsUnusable()`,
`providerRateLimited()`.

**Only swap when the result is identical.** In that pass, four call sites shared an error *code*
with the catalog but had their own message ("Unknown worker endpoint." versus the catalog's
"Unknown API endpoint."). Those stayed as explicit constructors. Verify the swap mechanically: for
every replaced constructor, compare its status and message with what the helper produces.

## 3. One check, one helper

```ts
// Before: the same bound enforced in two functions, with the message typed twice
function transcript(messages) {
  if (messages.length === 0 || messages.length > 200) {
    throw new ApiError(400, 'invalid_messages', 'Provide between 1 and 200 text messages.');
  }
  …
}
function checkMessageCardinality(endpoint, body) {
  …
  if (messages.length === 0 || messages.length > 200) {
    throw new ApiError(400, 'invalid_messages', 'Provide between 1 and 200 text messages.');
  }
}
```

```ts
// After
function assertMessageCount(count: number): void {
  if (count === 0 || count > MAX_MESSAGES) {
    throw catalogError('invalid_messages');
  }
}
```

The same pass merged a duplicated image-result bounds check (`assertImageResultBounds`), a
duplicated JSONL line splitter (`nonBlankLines`), and two copies of a bounded output reader.

## 4. A block of `let`s becomes one decoder per variant

```ts
// Before: six mutable variables, three branches assigning different subsets of them
export function requestSpec(endpoint, body, models, imageEditing = false) {
  let prompt: string;
  let model: string;
  let stream = false;
  let includeUsage = false;
  let reasoningEffort: Job['reasoningEffort'];
  let outputSchema: Job['outputSchema'];
  let imageOptions: Job['imageOptions'];

  if (endpoint === 'responses') {
    const input = decode(Responses, body);
    model = input.model;
    …
  } else if (endpoint === 'chat') {
    …
  } else {
    …
  }
  …
}
```

```ts
// After: each variant returns a value; the parent only validates and assembles
export function requestSpec(endpoint, body, models, imageEditing = false): RequestSpec {
  checkMessageCardinality(endpoint, body);

  const references: ReferenceImage[] = [];
  const decoders = { responses: decodeResponses, chat: decodeChat, images: decodeImages };
  const { model, prompt, reasoningEffort, outputSchema, imageOptions, stream, includeUsage } =
    decoders[endpoint](body, references);
  if (!prompt.trim() || Buffer.byteLength(prompt) > MAX_PROMPT_BYTES) {
    throw catalogError('invalid_input');
  }
  …
}
```

A lookup object keyed by a union (`decoders[endpoint]`) or a `switch` over it both work; the
`Record<Endpoint, …>` form makes TypeScript check that every variant is handled.

## 5. Nested ternaries become small functions

```ts
// Before
const level = Exit.isSuccess(exit) ? 'info' : cancelled ? 'warn' : safe.code === 'provider_timeout' ? 'warn' : 'error';

const contentType = bytes[0] === 0x89 ? 'image/png' : bytes[0] === 0xff ? 'image/jpeg' : bytes.subarray(8, 12).toString() === 'WEBP' ? 'image/webp' : undefined;

const encoded = format === 'png' ? image.png() : format === 'jpeg' ? image.jpeg({ quality }) : image.webp({ quality });
```

```ts
// After
function logLevelFor(exit: Exit.Exit<unknown, unknown>, code: string): LogLevel {
  if (Exit.isSuccess(exit)) {
    return 'info';
  }

  if (isCancelled(exit) || code === 'provider_timeout') {
    return 'warn';
  }

  return 'error';
}

function encode(image: Sharp, format: ImageFormat, quality: number): Sharp {
  switch (format) {
    case 'png':
      return image.png();
    case 'jpeg':
      return image.jpeg({ quality });
    case 'webp':
      return image.webp({ quality });
  }
}
```

A single, flat ternary choosing between two simple values (`kind === 'image' ? 'image' : 'text'`)
is fine. Nesting is the problem.

## 6. Conditional spreads become builders

```ts
// Before: the same three optional fields spread in two places
return {
  created,
  output_format: result.imageFormat ?? 'png',
  quality: 'auto',
  ...(result.imageSize ? { size: result.imageSize } : {}),
  ...(result.imageBackground ? { background: result.imageBackground } : {}),
  data: result.images.map((b64_json) => ({ b64_json })),
};
```

```ts
// After
function imageMetadata(result: Result) {
  return {
    output_format: result.imageFormat ?? 'png',
    quality: 'auto',
    ...(result.imageSize ? { size: result.imageSize } : {}),
    ...(result.imageBackground ? { background: result.imageBackground } : {}),
  };
}

return { created, ...imageMetadata(result), data: result.images.map((b64_json) => ({ b64_json })) };
```

Under `exactOptionalPropertyTypes`, `...(x ? { x } : {})` is the idiomatic way to omit a key, so a
lone one is fine. Extract when the same group repeats, or when an object literal is mostly
conditional spreads.

## 7. Positional `undefined` becomes an options object

```ts
// Before
responseObject(endpoint, spec.job.model, result, undefined, undefined, spec.job.reasoningEffort);

function uncheckedResponseObject(
  endpoint: Endpoint,
  model: string,
  result: Result,
  id: string = randomUUID(),
  created = Math.floor(Date.now() / 1000),
  reasoningEffort?: Job['reasoningEffort'],
) { … }
```

```ts
// After
responseObject(endpoint, spec.job.model, result, { reasoningEffort: spec.job.reasoningEffort });

interface ResponseOptions {
  readonly id?: string;
  readonly created?: number;
  readonly reasoningEffort?: Job['reasoningEffort'];
}

function uncheckedResponseObject(
  endpoint: Endpoint,
  model: string,
  result: Result,
  { id = randomUUID(), created = unixSeconds(), reasoningEffort }: ResponseOptions = {},
) { … }
```

Only change a signature when you can update every caller. In a parallel pass, an export imported
by another area's files is off limits. Add a comment at the call site instead
(`// undefined selects the default runner`).

## 8. Ternaries between pipelines become named steps

```ts
// Before: a parenthesized ternary of two multi-line pipelines, piped again
yield* (
  provider !== 'opencode'
    ? readJsonCredentials(provider, source).pipe(
        Effect.flatMap((bytes) =>
          fs.writeFile(target, bytes, { mode: 0o600 }).pipe(Effect.uninterruptible, Effect.mapError(publicError)),
        ),
      )
    : copyDatabaseEffect(source, target)
).pipe(
  Effect.mapError(
    () =>
      new ApiError(503, 'invalid_credentials', 'Provider credentials are invalid or inaccessible. Check login and storage access.'),
  ),
);
```

```ts
// After: a helper for the repeated combinator pair, a named choice, one error mapping
function settled<A, E, R>(mutation: Effect.Effect<A, E, R>) {
  return mutation.pipe(Effect.uninterruptible, Effect.mapError(publicError));
}

const copy =
  provider === 'opencode'
    ? copyDatabaseEffect(source, target)
    : readJsonCredentials(provider, source).pipe(
        Effect.flatMap((bytes) => settled(fs.writeFile(target, bytes, { mode: 0o600 }))),
      );
yield* copy.pipe(Effect.mapError(credentialsUnusable));
```

Put the positive condition first (`=== 'opencode'` rather than `!== 'opencode'`).

## 9. Long sequential functions become a table of contents

A ~100-line `executeEffect` that prepared a workspace, wrote inputs, installed credentials,
obtained a token, ran the CLI, checked structured output, refreshed saved credentials and cleaned
up became:

```ts
writeJobInputs(job, work);
installCredentials(provider, home);
withAccessToken(provider, home, run);
checkStructuredOutput(job, work);
refreshSavedCredentials(provider, home);
removeWorkspace(work);
```

Each helper is short and named for its step, and the parent reads in order. The same treatment
turned a 540-line container contract script into named phases (build images, isolate networks,
prepare state, check endpoints, check logs, clean up) run from a short main program.

Keep the order of side effects identical when you split. Reordering validation or cleanup is a
behavior change.

## 10. Long strings and file contents

```ts
// Before
`LOCAL_UID=${uid}\nLOCAL_GID=${gid}\n# Supply APP_API_KEY through your environment or secret manager.\nMODEL=\nREQUEST_TIMEOUT_MS=110000\n`
```

```ts
// After
[
  `LOCAL_UID=${uid}`,
  `LOCAL_GID=${gid}`,
  '# Supply APP_API_KEY through your environment or secret manager.',
  'MODEL=',
  'REQUEST_TIMEOUT_MS=110000',
  '', // trailing newline
].join('\n');
```

- Split prose at sentence boundaries:
  `'Docker authentication command failed. ' + 'Check Docker availability and the provider message above.'`
- Build long prompts from named parts (`imagePrompt()` composed of named instruction constants).
  Then check the output is byte-identical to the old version for a representative set of inputs,
  for example with a throwaway script that renders both.
- Build long templates (such as a `docker info --format` template) from a field map rather than
  one 200-character literal, and check the rendered string is identical.

## 11. Inferred types that widen

Extracting a helper can silently widen an inferred type. In the pass this file comes from,
rewriting `releaseSqlite` changed `withSqliteResource`'s error channel from `ApiError` to
`unknown`, which broke typecheck in a different module three calls away. The fix is to annotate the
helper (`function releaseSqlite(…): Effect.Effect<void, ApiError>`), not to loosen the callers.
After splitting a function, compare the exported types before and after. A full `tsc --noEmit`
across the whole project catches this; checking one file doesn't.

## 12. Comments

```ts
// Before: telegraphic, restates the code, or runs past the line width
/**
 * Strict Responses subset: unsupported knobs must not be silently ignored.
 */
// Capture the HTTP client service once; each job owns its transport scope, deadline and bounded response stream. Production uses the Node Undici backend so Fetch's implicit header deadline cannot truncate long image jobs.
// increment counter
```

```ts
// After
/**
 * The subset of the Responses API the gateway supports. Unknown fields are rejected rather than
 * ignored, so a client never believes an option took effect when it didn't.
 */

/**
 * Capture the HTTP client service once; each job owns its transport scope, deadline and bounded
 * response stream. Production uses the Node Undici backend so Fetch's implicit header deadline
 * cannot truncate long image jobs.
 */

// (the "increment counter" comment is deleted)
```

Also fix typos in identifiers and docs while you're there (`Codex0.166.0` became
`Codex 0.166.0`).

## 13. Test timing

```ts
// Before: a hard 500 ms deadline for a fixture that is expected to exit with code 1
await runProcess(invocation, controller.signal, 500);
```

Under full-suite load, starting a fresh Node runtime took 625 ms, so the fixture was killed as a
*timeout* and the test saw no failure output. That made it flaky, and the flakiness predated the
refactor.

```ts
// After
/**
 * Fixtures that exit on their own get generous headroom: under full-suite load, starting a fresh
 * Node runtime can exceed half a second, and a deadline hit would be classified as a timeout
 * instead of the nonzero exit under test.
 */
const EXIT_FIXTURE_TIMEOUT_MS = 3_000;

/**
 * Fixtures that never exit only need to outlive their own output before the deadline fires.
 */
const HANGING_FIXTURE_TIMEOUT_MS = 500;
```

Investigate a flaky test before calling the work done: read the failing assertion, find what
differs under load, and fix the cause. "It was flaky before I started" explains the failure but
doesn't fix it.

## 14. Things that looked wrong but stayed

- **An import cycle.** `domain.ts` kept its own error messages because importing the catalog would
  have created a cycle.
- **A type-inference cliff.** Pulling shared Effect layer provisioning into one helper made Effect
  infer the wrong router type, so the inline form stayed.
- **A subtle state machine.** A buffered log sink's listener handling was left alone; only helpers
  around it were extracted.
- **Verbatim text.** Scripts passed to child processes and fake CLIs embedded in tests kept their
  exact bytes, even past the line width.
- **Long test names.** They stayed on one line so they remain greppable.

Say what you left and why in the final report, so the reader doesn't assume it was missed.

## 15. Lumped-together code gets blank lines between steps

The most common complaint about agent-written code is that it is "lumped together": every
statement directly below the previous one, so the reader can't see where one step ends.

```ts
// Before
export function classifyProcessFailure(provider: Provider, error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }
  const output = processFailureOutput(error);
  if (provider === 'codex' || output === undefined) {
    return providerFailure();
  }
  let failure: ApiError | undefined;
  for (const line of nonBlankLines(output)) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return providerFailure();
    }
    if (!isRecord(value)) {
      return providerFailure();
    }
    const classified = providers[provider].eventFailure(value);
    // An unknown (502) error keeps the whole failed stream generic.
    if (classified?.status === 502) {
      return classified;
    }
    failure = classified ?? failure;
  }
  return failure ?? providerFailure();
}
```

```ts
// After
export function classifyProcessFailure(provider: Provider, error: unknown): ApiError {
  if (error instanceof ApiError) {
    return error;
  }

  const output = processFailureOutput(error);
  if (provider === 'codex' || output === undefined) {
    return providerFailure();
  }

  let failure: ApiError | undefined;
  for (const line of nonBlankLines(output)) {
    let value: unknown;
    try {
      value = JSON.parse(line);
    } catch {
      return providerFailure();
    }

    if (!isRecord(value)) {
      return providerFailure();
    }

    const classified = providers[provider].eventFailure(value);
    // An unknown (502) error keeps the whole failed stream generic.
    if (classified?.status === 502) {
      return classified;
    }

    failure = classified ?? failure;
  }

  return failure ?? providerFailure();
}
```

Every closed block that is followed by more code gets a blank line. The pairs that belong together
stay together: `const output` and the `if` that checks it, `let failure` and the loop that fills
it, the comment and the `if` it explains. `} catch {` keeps no blank line because it continues the
same statement.

The opposite mistake, a blank line after every statement, came up as soon as the first one was
fixed. These are wrong:

```ts
// Wrong: a value separated from its check
const value = values[source];

if (!value || /[\r\n\0]/.test(value)) {

// Wrong: a comment separated from its code
// The connector must use the env-file token.

if (connector.env_file !== envFile) {

// Wrong: a result separated from its return
const result = { ...selected, templates };

return named ? { ...host, ingress: result } : { ...host, proxy: result };
```

Each of these pairs is one step: remove the blank line.

## 16. A long condition becomes a list of named checks

```ts
// Before: eleven requirements, one generic error
// Custom templates retain the connector's process and filesystem isolation.
if (
  connector.read_only !== true ||
  connector.privileged ||
  connector.ports?.length ||
  connector.volumes?.length ||
  connector.build ||
  connector.network_mode ||
  connector.pid ||
  connector.ipc ||
  connector.cap_add?.length ||
  !connector.cap_drop?.includes('ALL') ||
  !connector.security_opt?.includes('no-new-privileges:true')
) {
  throw invalid;
}
```

```ts
// After: one check per requirement, each naming what failed
const ALLOWED_CONNECTOR_SETTINGS = new Set([
  'image',
  'command',
  'env_file',
  'read_only',
  'cap_drop',
  'security_opt',
]);

function requireCondition(condition: unknown, requirement: string): asserts condition {
  if (!condition) {
    throw new TemplateError(`Cloudflare Compose template must ${requirement}`);
  }
}

requireCondition(
  Object.keys(connector).every((key) => ALLOWED_CONNECTOR_SETTINGS.has(key)),
  'use only the supported connector settings',
);

// The allowlist already excludes ports, volumes, builds and namespace or privilege overrides.
requireCondition(connector.read_only === true, 'keep the connector filesystem read-only');
requireCondition(connector.cap_drop?.includes('ALL'), 'drop all connector capabilities');
requireCondition(
  connector.security_opt?.includes('no-new-privileges:true'),
  'prevent privilege escalation',
);
```

- The deny-list of seven forbidden fields became one allowlist check, which also rejects fields
  nobody thought to forbid.
- The error now says which requirement failed. That changes the error text, so in a readability
  pass report it as an intended change.
- A short condition about one value stays as it is:
  `if (!token || /[\r\n\0]/.test(token) || !TOKEN_PATTERN.test(token))` tests one token three
  ways and reads fine.

## 17. Banner comments become files

```ts
// Before: alchemy.run.ts
// ── Data ──────────────────────────────
export const db = await D1Database('db');
export const photos = await R2Bucket('photos');

// ── Workers ───────────────────────────
export const api = await Worker('api', { bindings: { db, photos } });
```

```text
After:
infra/
  data.ts         db, photos
  workers.ts      api (imports from ./data.ts)
alchemy.run.ts    imports both, no section comments
```

These separators mark separate concerns, so the file does several jobs: split it along them and
name each module after its section. The same goes for `// ─── Google and Tripadvisor listings ───`
above one table in a schema file: one schema per file.

When the banners only sort one concern's declarations by kind (`// ── Types ──`,
`// ── Queries ──`, `// ── Helpers ──`) in a file of reasonable size, delete them and keep the
file. Splitting by kind would scatter one concept across `types.ts`, `queries.ts` and
`helpers.ts`, which is grouping by file type. Say in the reply why the file stayed whole.

A plain sentence above a group of statements inside a function is fine:

```ts
// Keep the stack identity fixed while allowing supported runtime tuning.
requireCondition(service.image === expectedImage, 'use the pinned image');
requireCondition(service.container_name === undefined, 'leave container naming to Compose');
```

## 18. Comments that point at plans and history

```ts
// Before
// Per ADR-0007 (phase 2 of the plan) we soft-delete.
// Updated 2026-10-12: now retries 3 times instead of 5.
/**
 * Gets the order.
 */
export function loadOrder(id: OrderId): Effect.Effect<Order, OrderNotFound, Database> { … }

console.log('token', decodeJwt(token));
```

```ts
// After
/**
 * Loads an order, including soft-deleted ones, so refunds can still read an order's history after
 * the customer removes it. Retries three times, which covers a database failover; more attempts
 * only delay the error the caller has to show anyway.
 */
export function loadOrder(id: OrderId): Effect.Effect<Order, OrderNotFound, Database> { … }

// Demo only: the decoded token is logged so the sign-in flow is visible. Never do this in
// production.
console.log('token', decodeJwt(token));
```

- The ADR, the plan phase, the date and "instead of 5" are gone; the reasons they pointed at are
  in the comment. Plans and ADRs get deleted or go stale, and a comment that points at them stops
  explaining anything.
- The placeholder JSDoc that restated the function name now says what a caller needs to know.
  Write it from the code, its tests and its history; a script that fills in JSDoc for the linter
  produces exactly the placeholder above.
- The deliberate shortcut is marked where it happens, instead of hiding behind an environment flag
  nobody sets.

## 19. Home-made wrappers become the framework's mechanism

```ts
// Before: a hand-passed dependency bag and a custom operation helper around oRPC
type Deps = { db: Database; auth: AuthClient; mailer: Mailer };

const defineOperation = <I, O>(handler: (deps: Deps, input: I) => Promise<O>) =>
  (deps: Deps) => (input: I) => handler(deps, input);

export const createOrder = defineOperation(async (deps, input: CreateOrderInput) => { … });
```

```ts
// After: oRPC's own context and router
const base = os.$context<{ db: Database; auth: AuthClient; mailer: Mailer }>();

export const createOrder = base
  .input(CreateOrderInput)
  .handler(async ({ input, context }) => { … });

export const router = { orders: { create: createOrder } };
```

The framework already has a way to pass context and define procedures; the wrapper added a second
way that every contributor had to learn. The same reasoning applies to an empty worker that only
calls a package (move the logic into the worker), to a hand-rolled client next to an official SDK,
and to child-process code next to the platform's process API.

## 20. Thrown errors and console logs in Effect code

```ts
// Before
export const syncFeed = (deps: Deps, url: string) =>
  Effect.tryPromise(async () => {
    const response = await deps.fetchFeed(url);
    if (!response.ok) {
      throw new Error('Feed unavailable');
    }
    console.log('synced', url);
    return deps.save(await response.json());
  });
```

```ts
// After
export class FeedUnavailable extends Schema.TaggedError<FeedUnavailable>()('FeedUnavailable', {
  url: Schema.String,
}) {}

export const syncFeed = Effect.fn('syncFeed')(function* (
  url: string,
): Effect.fn.Return<void, FeedUnavailable | StoreError, FeedClient | FeedStore> {
  const client = yield* FeedClient;
  const store = yield* FeedStore;

  const feed = yield* client.fetch(url);
  if (feed === undefined) {
    return yield* new FeedUnavailable({ url });
  }

  yield* store.save(feed);
  yield* Effect.logInfo('Synced feed').pipe(Effect.annotateLogs({ url }));
});
```

- The failure is a tagged error in the error channel, so callers see it in the type and handle it
  with `Effect.catchTag`, instead of an untyped exception turned into `UnknownError` by
  `tryPromise`.
- The `Deps` argument became two services provided through a `Layer`; tests provide fakes.
- The log line has a readable message, with the URL as an annotation rather than part of a
  string.
