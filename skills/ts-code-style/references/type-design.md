# Type design

How to model data with TypeScript's type system, where to validate input, and how to shape modules.
Most of this follows Matt Pocock's Total TypeScript articles (linked per section). The exception is
runtime validation: we use Effect Schema where his articles use Zod.

## Contents

1. [Compiler and lint settings](#1-compiler-and-lint-settings)
2. [`type` by default, `interface` for inheritance](#2-type-by-default-interface-for-inheritance)
3. [Discriminated unions instead of a bag of optionals](#3-discriminated-unions-instead-of-a-bag-of-optionals)
4. [`as const` objects instead of enums](#4-as-const-objects-instead-of-enums)
5. [Property syntax for function members](#5-property-syntax-for-function-members)
6. [No `any`, and `unknown` at the edges](#6-no-any-and-unknown-at-the-edges)
7. [Validate untrusted input with Effect Schema](#7-validate-untrusted-input-with-effect-schema)
8. [Branded types for validated values](#8-branded-types-for-validated-values)
9. [Type predicates and assertion functions](#9-type-predicates-and-assertion-functions)
10. [Return types](#10-return-types)
11. [Where types live](#11-where-types-live)
12. [Small conventions](#12-small-conventions)
13. [Deep modules](#13-deep-modules)

## 1. Compiler and lint settings

Source: [The TSConfig Cheat Sheet](https://www.totaltypescript.com/tsconfig-cheat-sheet).

The strictness flags below belong in every project. `noUncheckedIndexedAccess` is the one most
projects lack: it types `items[0]` and `record[key]` as possibly `undefined`, which is the truth at
runtime.

```jsonc
{
  "compilerOptions": {
    // Strictness
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,

    // Base
    "target": "es2022",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "moduleDetection": "force",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "erasableSyntaxOnly": true, // TypeScript 5.8+; see section 4

    // Pick one pair:
    "module": "NodeNext", // tsc emits the JavaScript (add "outDir": "dist")
    // "module": "preserve", "noEmit": true, // a bundler emits the JavaScript
  },
}
```

- `verbatimModuleSyntax` makes type-only imports explicit (`import type { User } from './user'`),
  so nothing is imported at runtime that only the type checker needed.
- `erasableSyntaxOnly` rejects enums, namespaces and constructor parameter properties. Without
  them, removing the types leaves runnable JavaScript, which is what Node's built-in TypeScript
  support needs
  ([article](https://www.totaltypescript.com/erasable-syntax-only)). With this flag, use
  `package.json#imports` (`"#lib/*"`) for import aliases instead of `paths`.
- Libraries also need `"declaration": true`. Libraries in a monorepo also need `"composite": true`,
  `"declarationMap": true` and `"sourceMap": true`.
- `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns` and `noFallthroughCasesInSwitch` are
  optional. Matt calls them noisy, and a linter reports unused code better.

Lint rules that back up this file (typescript-eslint names):

- `@typescript-eslint/no-explicit-any`
- `@typescript-eslint/method-signature-style: ['error', 'property']`
- `@typescript-eslint/consistent-type-definitions: ['error', 'type']`
- `@typescript-eslint/array-type: ['error', { default: 'array' }]`
- `@typescript-eslint/switch-exhaustiveness-check`
- `@typescript-eslint/consistent-type-imports` (if `verbatimModuleSyntax` is off)
- `no-redeclare` (catches accidental interface merging)

Turning on strict flags across an existing codebase can produce hundreds of errors. Report what a
flag would flag and let the user decide. Don't combine that with another change.

## 2. `type` by default, `interface` for inheritance

Source: [Type vs Interface](https://www.totaltypescript.com/type-vs-interface-which-should-you-use).

Use `type` by default. It can express unions, mapped and conditional types, and it never merges
by surprise. Use `interface ... extends` when one object type builds on another: TypeScript
caches interfaces by name, so `extends` checks faster than a deep chain of `&` intersections.

```ts
type OrderId = string;
type PaymentState = 'pending' | 'captured' | 'refunded';

interface BaseEvent {
  id: string;
  occurredAt: Date;
}

interface OrderPlaced extends BaseEvent {
  orderId: OrderId;
}
```

Two interfaces with the same name in the same scope merge silently, which is useful for augmenting
library types (`declare global`, `Window`) and a bug anywhere else.

## 3. Discriminated unions instead of a bag of optionals

Source: [Discriminated unions](https://www.totaltypescript.com/discriminated-unions-are-a-devs-best-friend).

An object full of optional fields allows states that can't happen: a success with no data, a
loading state that carries an error.

```ts
// Before: compiles with { status: 'success' } and no data
type FetchState = {
  status: 'loading' | 'success' | 'error';
  data?: Order;
  error?: Error;
};

// After: each state carries exactly what exists in it
type FetchState =
  | { status: 'loading' }
  | { status: 'success'; data: Order }
  | { status: 'error'; error: Error };
```

Callers narrow on the discriminant before they touch `data` or `error`, which is the point. Switch
on it and let the compiler prove every case is handled:

```ts
function describe(state: FetchState): string {
  switch (state.status) {
    case 'loading':
      return 'Loading…';
    case 'success':
      return `Order ${state.data.id}`;
    case 'error':
      return state.error.message;
    default:
      return assertNever(state);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled case: ${JSON.stringify(value)}`);
}
```

The same applies to props and options. Write `variant: 'with-button'; buttonText: string` as one
member of a union, not `buttonText?: string` alongside `variant`.

In Effect code, model errors and domain variants as tagged unions too (`Schema.TaggedStruct`,
`Schema.TaggedError`) and handle them with `Effect.catchTag` or `Match`.

## 4. `as const` objects instead of enums

Sources: [Why I don't like enums](https://www.totaltypescript.com/why-i-dont-like-typescript-enums),
[`erasableSyntaxOnly`](https://www.totaltypescript.com/erasable-syntax-only).

Numeric enums accept any number, add reverse-mapping keys to `Object.keys`, and enums compare
nominally. Don't add enums to new code. Use a string-literal union, or an `as const` object when
you also need the values at runtime:

```ts
const OrderStatus = {
  Draft: 'draft',
  Paid: 'paid',
  Shipped: 'shipped',
} as const;

type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];
// 'draft' | 'paid' | 'shipped'

ship(OrderStatus.Paid); // ok
ship('paid'); // ok, and matches the JSON on the wire
```

With Effect Schema, the schema can be the single source: `const OrderStatus =
Schema.Literals(['draft', 'paid', 'shipped'])` and `type OrderStatus = typeof OrderStatus.Type`
(Effect 3: `Schema.Literal('draft', 'paid', 'shipped')`).

Existing enums: leave them in a readability pass, because replacing one changes runtime values and
every import site. If one must stay, give every member an explicit string value.

Namespaces and constructor parameter properties (`constructor(private readonly db: Db)`) are
also not erasable. In new code use modules, and declare fields explicitly.

## 5. Property syntax for function members

Source: [Method shorthand considered harmful](https://www.totaltypescript.com/method-shorthand-syntax-considered-harmful).

Method shorthand in a type is checked bivariantly: an implementation whose parameter is
narrower than declared still compiles, and fails at runtime when called with the wider type.

```ts
// Before: accepts an implementation that only handles Circle
type Shape = {
  compareTo(other: Shape): boolean;
};

// After: the narrower implementation is a compile error
type Shape = {
  compareTo: (other: Shape) => boolean;
};
```

This is about declarations only. Implementations can still use method or arrow syntax. Enforce it
with `@typescript-eslint/method-signature-style: ['error', 'property']`.

Never use the `Function` type. Write the signature (`(event: Event) => void`), or
`(...args: any[]) => unknown` for "any function" in a generic constraint.

## 6. No `any`, and `unknown` at the edges

Sources: [`any` considered harmful](https://www.totaltypescript.com/any-considered-harmful),
[An `unknown` can't always fix an `any`](https://www.totaltypescript.com/an-unknown-cant-always-fix-an-any).

`any` turns off checking for everything it touches and spreads through inference. Ban it with
`no-explicit-any`. Data from outside the program (`JSON.parse`, `fetch`, `localStorage`,
`process.env`, message events) is `unknown` until a schema decodes it (section 7).

Two cases where `any` is correct, each with an `eslint-disable-next-line` comment saying why:

- **Generic constraints that mean "any function"**: `T extends (...args: any[]) => any`.
  `unknown[]` parameters reject functions that take a `string`, because parameters are checked
  contravariantly.
- **Returning from a function with a conditional return type**, where TypeScript can't match the
  branches to the condition: `return value as any`. Cover that function with a unit test, because
  the compiler no longer checks it.

`as SomeType` on data you haven't checked is the same risk under another name. Prefer
`satisfies` to check a literal against a type without widening it:

```ts
const ROUTES = {
  home: '/',
  order: '/orders/:id',
} satisfies Record<string, `/${string}`>;
// ROUTES.order stays the literal type '/orders/:id'
```

## 7. Validate untrusted input with Effect Schema

Source for when to validate: [When should you use Zod?](https://www.totaltypescript.com/when-should-you-use-zod).
We follow its rules but use Effect Schema as the library.

**When to validate.** Decode at the edge, once, and pass typed values inward:

- Always: anything you don't trust, such as request bodies, headers and query strings, form data,
  CLI arguments, environment variables, WebSocket and `postMessage` events, and `localStorage`.
- Usually: third-party APIs you don't control, so a change in their response shape fails loudly
  at the boundary instead of deep in the program.
- Optional: your own frontend calling your own backend from the same deploy. Shared types are
  often enough here.

**Which library.**

1. **If the codebase uses Effect** (`effect` in `package.json`), use Effect Schema. Never add
   Zod, Valibot or ArkType to an Effect codebase. Schema decodes into `Effect` values with typed
   `SchemaError`s, encodes as well as decodes, and works with `HttpApi`, `Config`, RPC and
   `Schema.Class` without adapters.
2. **New projects or packages, and codebases with no validation library yet**: add `effect`
   and use Effect Schema, even when nothing else uses Effect. It runs on its own; you can call
   `Schema.decodeUnknownSync` without the rest of Effect, and the choice is worth one sentence
   in your answer, since many people expect Zod.
3. **An existing non-Effect codebase that has standardized on Zod**: keep Zod for consistency.
   One validation library per codebase matters more than which one. Say that Effect Schema is the
   preferred choice if the user wants to switch.
4. **A library that requires a validator** (forms, tRPC, AI SDK): most accept Standard Schema.
   Pass `Schema.toStandardSchemaV1(MySchema)` instead of pulling in Zod.

Effect 4 exports Schema from the core package (`import { Schema } from 'effect'`). Effect 3.10+
does too; older code imports from `@effect/schema`. Match whatever the codebase already uses.

```ts
import { Effect, Schema } from 'effect';

const MAX_ORDER_ITEMS = 50;

const OrderItem = Schema.Struct({
  sku: Schema.NonEmptyString,
  quantity: Schema.Int.check(Schema.isGreaterThan(0)),
});

const CreateOrderRequest = Schema.Struct({
  customerId: Schema.NonEmptyString,
  items: Schema.Array(OrderItem).check(Schema.isMaxLength(MAX_ORDER_ITEMS)),
  note: Schema.optional(Schema.String),
});

// Derive the type from the schema; don't write it twice
type CreateOrderRequest = typeof CreateOrderRequest.Type;

// In Effect code: failures are typed and flow through the error channel
const parseCreateOrder = Schema.decodeUnknownEffect(CreateOrderRequest);

const handle = (body: unknown) =>
  Effect.gen(function* () {
    const request = yield* parseCreateOrder(body);
    return request.items.length;
  });

// Outside Effect: throws on invalid input
const request = Schema.decodeUnknownSync(CreateOrderRequest)(JSON.parse(rawBody));
```

The examples use Effect 4. Effect 3 names differ: `Schema.decodeUnknown` instead of
`decodeUnknownEffect`, pipeable filters (`Schema.Int.pipe(Schema.positive())`,
`Schema.maxItems(n)`, `Schema.pattern(re)`) instead of `.check(...)`, the variadic
`Schema.Literal('a', 'b')` instead of `Schema.Literals([...])`, and `Schema.standardSchemaV1`
instead of `toStandardSchemaV1`. Check the installed major version before writing schema code.

The rest of this file's rules apply to schemas too. Name limits (`MAX_ORDER_ITEMS`), keep one schema
per shape and reuse it, derive types with `typeof X.Type` (and `typeof X.Encoded` for the wire
shape), and keep schemas next to the boundary that decodes them.

## 8. Branded types for validated values

Source: [Four essential TypeScript patterns](https://www.totaltypescript.com/four-essential-typescript-patterns).

When a `string` can be an email, a user id or a raw password, the compiler can't tell them apart
(the Primitive Obsession smell). A brand marks a value as checked, so a function that needs a
validated email can't receive an unchecked string:

```ts
const Email = Schema.String.check(Schema.isPattern(EMAIL_PATTERN)).pipe(Schema.brand('Email'));
type Email = typeof Email.Type; // string & Brand<'Email'>

const sendReceipt = (to: Email) => {
  /* ... */
};

sendReceipt('a@b.c'); // error: plain string
sendReceipt(Schema.decodeUnknownSync(Email)(input)); // ok
```

Without Effect: `type Email = string & { readonly __brand: 'Email' }` plus a single
`parseEmail(raw: string): Email` function that is the only place a cast happens.

Brand ids that are easy to mix up (`UserId` and `OrderId`), and values whose validation matters
for security. Don't brand everything.

## 9. Type predicates and assertion functions

Source: [Four essential TypeScript patterns](https://www.totaltypescript.com/four-essential-typescript-patterns).

Put a repeated narrowing check in a named function so the compiler carries the result forward:

```ts
const isDefined = <T>(value: T | undefined): value is T => value !== undefined;
const skus = items.map((item) => item.sku).filter(isDefined); // string[]

function assertIsAdmin(user: User): asserts user is AdminUser {
  if (user.role !== 'admin') {
    throw notAuthorized();
  }
}
```

A predicate is an unchecked promise: if the body is wrong, every caller is wrong. Keep
predicates tiny, and test them. TypeScript 5.5+ infers simple predicates like
`(x) => x !== undefined` by itself.

## 10. Return types

Source: [Should you declare return types?](https://www.totaltypescript.com/should-you-declare-return-types).

Declare return types on exported, top-level functions. The signature then documents the contract
and keeps implementation changes from silently changing what callers receive (see
[patterns.md, section 11](patterns.md#11-inferred-types-that-widen)). Let inference handle local
helpers, callbacks and JSX components (they always return JSX).

In Effect code, annotate exported functions that return effects with
`Effect.Effect<Success, Error, Requirements>`, so a widened error channel shows up where the
function is defined.

## 11. Where types live

Source: [Where to put your types](https://www.totaltypescript.com/where-to-put-your-types-in-application-code).

- A type used in one file stays in that file, inline if it's small. Don't create
  `Component.types.ts` next to every component; you edit them together anyway.
- A type used by several modules moves to a `*.types.ts` file in the smallest folder that
  contains all of them (`orders/orders.types.ts`, then `src/shared.types.ts`).
- A type shared by several packages in a monorepo moves to a shared package.
- A type derived from a schema lives next to the schema.

## 12. Small conventions

- `T[]` rather than `Array<T>`, and `readonly T[]` for inputs you won't mutate. Lint for
  consistency; don't debate it ([article](https://www.totaltypescript.com/array-types-in-typescript)).
- Name generic parameters for what they hold when there is more than one or the meaning isn't
  obvious (`TInput`, `TOutput`); a lone `T` is fine.
- Type `process.env` by decoding it once at startup (Effect `Config`, or a schema), not by
  reading `process.env.X!` throughout the code.
- Type tests: when a helper's types are the product (a library, a generic utility), test them
  with `expectTypeOf` (Vitest) or `// @ts-expect-error` lines.

## 13. Deep modules

Source: the `codebase-design` skill in [mattpocock/skills](https://github.com/mattpocock/skills),
which builds on John Ousterhout's *A Philosophy of Software Design*.

A module (a function, file, class or package) is deep when it hides a lot of behavior behind a
small interface, and shallow when its interface is almost as complex as its body. Prefer deep
modules:

- **Deletion test.** If deleting a module removes complexity, it was a pass-through; inline it.
  If deleting it spreads complexity across its callers, it's earning its place.
- **Accept dependencies, don't create them.** `processOrder(order, payments)` is testable;
  `processOrder(order)` that calls `new StripeClient()` inside is not. In Effect, this is a
  service plus a `Layer`.
- **Return results, don't mutate.** `calculateDiscount(cart): Discount` beats
  `applyDiscount(cart): void`.
- **A seam needs two adapters.** Add an interface or service boundary only when something
  actually varies across it, typically production plus a test fake. An interface with one
  implementation is just indirection.
- **Test through the interface.** Tests that break when the implementation changes are testing
  past the interface.

When reviewing, also look for these code smells (Fowler, *Refactoring*), each a judgment call
rather than a hard rule: Mysterious Name, Duplicated Code, Feature Envy, Data Clumps, Primitive
Obsession, Repeated Switches, Shotgun Surgery, Speculative Generality, Message Chains and Middle
Man.
