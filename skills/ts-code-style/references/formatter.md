# Formatter settings

Format and lint with Vite+: oxfmt formats, oxlint lints, and `vp check` runs both with the
typecheck. New projects and projects without a formatter get the setup below. A project that
already uses a different formatter keeps it for now: set the values from this table in its config,
and suggest moving to Vite+ as a separate change, not as part of a readability pass.

| Setting | Value | Why |
| --- | --- | --- |
| Line width | 100 | 120 lets dense expressions stay on one line; 80 forces awkward breaks in typed signatures. |
| Quotes | single | Common TypeScript convention; any consistent choice is fine. |
| Semicolons | always | Avoids ASI edge cases. |
| Trailing commas | all | Smaller diffs when lists grow. |
| Arrow parens | always | `(x) => …` stays consistent when a second parameter or a type is added. |
| Object wrap | preserve | Lets a hand-expanded object stay multi-line for readability. |
| Import sorting | on, grouped | Type imports, external, internal, relative, each group separated. |

Pair it with an `.editorconfig` (2 spaces, LF, final newline, trim trailing whitespace).

## oxfmt, oxlint and JSDoc lint with Vite+ (`vite.config.ts`)

A complete setup: one config for the formatter and the type-aware linter, a pre-commit hook, and
`jsdoc-lint` for documentation comments. `vp check` formats, lints and typechecks, so there is no
separate `tsc` step.

```ts
import { defineConfig } from 'vite-plus';

/**
 * Paths neither the formatter nor the linter touches: dependencies, build output, agent worktrees,
 * vendored components and generated files.
 */
const ignoredPatterns = [
  '**/.claude/**',
  '**/dist/**',
  '**/node_modules/**',
  '**/*.tsbuildinfo',
  'pnpm-lock.yaml',
  // Add vendored and generated paths here, for example 'packages/ui/src/components/**' and
  // '**/routeTree.gen.ts'.
];

export default defineConfig({
  staged: {
    '*': 'vp check --fix',
    // jsdoc-lint checks a file named on the command line even when jsdoc.json excludes it, so this
    // glob leaves out tests and declarations itself.
    'src/**/!(*.test|*.spec|*.fixture|*.d).{ts,tsx,mts,cts}': 'jsdoc-lint',
  },
  fmt: {
    printWidth: 100, // keep an existing project's width unless the user agrees to change it
    singleQuote: true,
    semi: true,
    arrowParens: 'always',
    bracketSpacing: true,
    bracketSameLine: true,
    objectWrap: 'preserve',
    jsdoc: { commentLineStrategy: 'multiline' },
    sortImports: {
      groups: [
        'type-import',
        ['value-builtin', 'value-external'],
        'type-internal',
        'value-internal',
        ['type-parent', 'type-sibling', 'type-index'],
        ['value-parent', 'value-sibling', 'value-index'],
        'unknown',
      ],
    },
    sortPackageJson: true,
    ignorePatterns: ignoredPatterns,
  },
  lint: {
    plugins: ['typescript', 'unicorn', 'oxc', 'jsdoc'],
    jsPlugins: ['@stylistic/eslint-plugin'],
    rules: {
      curly: 'error',
      // A blank line after a block when more code follows it in the same block.
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try'], next: '*' },
      ],
      'jsdoc/check-tag-names': 'error',
      'jsdoc/check-access': 'error',
      'jsdoc/check-property-names': 'error',
      'typescript/no-deprecated': 'error',
    },
    options: { typeAware: true, typeCheck: true },
    ignorePatterns: ignoredPatterns,
  },
});
```

`jsdoc.json` tells `jsdoc-lint` which files need documentation comments:

```json
{
  "roots": ["."],
  "excludePaths": ["node_modules", "dist", "coverage"],
  "excludeFiles": ["\\.d\\.[cm]?ts$", "\\.test\\.[^.]+$", "\\.spec\\.[^.]+$", "\\.fixture\\.[^.]+$"],
  "includeExtensions": [".ts", ".tsx", ".mts", ".cts"]
}
```

- `roots` are scanned for folders that contain a `package.json`, and only those packages are
  checked. `["src"]` therefore checks nothing in a single-package project, yet still reports
  success. Use `["."]`, or the folders that hold the packages in a monorepo (`["apps",
  "packages"]`).
- It requires a multiline block (`/**`, the text, ` */` on separate lines) on every top-level
  declaration, not only exports: private helpers and top-level constants too. A single-line
  `/** … */` counts as missing. Documented fields of a type need a blank line between them.
  That is why the oxfmt config above sets `jsdoc: { commentLineStrategy: 'multiline' }`.

And one script runs every check:

```json
{
  "scripts": {
    "check": "vp check && jsdoc-lint",
    "format": "vp check --fix",
    "ready": "pnpm check && vp test"
  }
}
```

- `@stylistic/eslint-plugin` runs through oxlint's `jsPlugins` and needs installing as a dev
  dependency. The `prev` list covers `for-in`, `for-of` and `do-while`. Don't use the
  `block-like` selector: it also matches `const handler = () => { … };`.
- Leave the `staged` hook as `vp check --fix` on staged files only, so a commit never reformats
  files nobody touched.

## Lint rules that enforce readability

Formatters handle layout only. These lint rules catch some of the patterns in `SKILL.md` (names
from ESLint, typescript-eslint and unicorn; oxlint has most of them):

- `curly: 'error'`: always brace `if` bodies.
- `@stylistic/padding-line-between-statements` with
  `{ blankLine: 'always', prev: ['if', 'for', 'while', 'do', 'switch', 'try'], next: '*' }`: a blank
  line after a block when more code follows. The other spacing rules (a value next to its check, a
  comment next to its code) can't be linted; `scripts/style-check.mjs` checks them. It also
  covers braces and nested ternaries, and reports magic numbers, long functions and deep nesting
  as review items, so projects without this config still get those checks. It has no
  `max-params` (it counts optional parameters instead) and no type-aware checks such as
  `no-deprecated`.
- `no-nested-ternary` / `unicorn/no-nested-ternary`.
- `max-params` (for example 4): pushes long optional parameter lists toward options objects.
- `@typescript-eslint/no-magic-numbers`: noisy on a whole codebase, but useful as a one-off audit
  with `ignore: [0, 1, -1]`, `ignoreEnums`, and `ignoreReadonlyClassProperties`.
- `complexity` / `max-depth` / `max-lines-per-function`: run as warnings to find split candidates,
  not as hard limits.
- `@typescript-eslint/no-deprecated`, plus type-aware linting where available.

Don't turn on a strict new rule across a whole codebase in the same change as a readability pass.
Report what it would flag and let the user decide.
