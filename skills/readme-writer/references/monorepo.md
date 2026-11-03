# READMEs in a monorepo

A monorepo has four kinds of README, each with a different reader. Most problems come from
mixing them up: workspace setup repeated in every package, a package README written for
contributors and published to npm, an app README that is still the scaffolder's.

Examples come from well-known monorepos: Effect, TanStack Query, the Vercel AI SDK, Turborepo
and its `create-turbo` template, Next.js, Astro, tRPC, Changesets, cal.com, Documenso, Dub,
Supabase, uv, tokio and pnpm.

## Contents

- [Who reads which README](#who-reads-which-readme)
- [Before writing: map the workspace](#before-writing-map-the-workspace)
- [Root README](#root-readme)
- [Published package README](#published-package-readme)
- [Internal package README](#internal-package-readme)
- [App README](#app-readme)
- [Where contributor material goes](#where-contributor-material-goes)
- [Drift: the most common defect](#drift-the-most-common-defect)

## Who reads which README

| README | Reader | Where they see it | Answers |
| --- | --- | --- | --- |
| Root | Users of the project; for product repos also self-hosters and contributors | GitHub repo page | What is this, which package do I want, how do I start |
| Published package | Someone who found the package on npm, crates.io or PyPI | Registry page, often without the repo | What this package adds, how to install it with its peers, a working example, where the docs are |
| Internal package | A teammate in this repo | The folder on GitHub or in the editor | Who consumes it, how to import or extend it, the rules for changing it |
| App | A teammate or contributor | The folder | How to run this one app from the root, its env vars, port, the services and packages it depends on |

## Before writing: map the workspace

Read these before writing a word, and keep the facts you'll cite:

- The workspace config (`pnpm-workspace.yaml`, `workspaces` in `package.json`, `Cargo.toml`
  `[workspace]`, `go.work`), and every package's manifest: `name`, `private`, `version`,
  `description`, `bin`, `exports`, `peerDependencies`, `engines`, `scripts`.
- The lockfile, which decides the package manager for every command you write.
- The task runner config (`turbo.json` tasks, `nx.json`, the root `scripts`), so filter commands
  and task names are real.
- Which apps depend on which workspace packages (`workspace:*` dependencies).
- Each app's dev script (port flags), `.env.example`, and the services it connects to
  (`docker-compose.yml`, database URLs in the config loader).
- Existing CONTRIBUTING.md, DEVELOPERS.md, ARCHITECTURE.md, and any docs site.
- Release tooling (`.changeset/`, release workflows), which tells you which packages are public.

## Root README

Write it for whoever arrives at the repo. For a library or tool family, that's users. For a
product (cal.com, Documenso, Dub), contributors and self-hosters overlap with users, so local
development belongs in the root or in a DEVELOPERS.md linked from it.

````markdown
# Project

One or two sentences: what it is and who it's for.

## Install / Quick start
<!-- library: the main entry package; product: the hosted app link and the self-host docs -->

## Packages
<!-- only when users choose between packages -->

One sentence on how they relate and are versioned. Effect: "All packages listed below are
released together with synchronized versions."

| Package | Description |
| --- | --- |
| [`@scope/core`](packages/core) | One line. |
| [`@scope/react`](packages/react) | React bindings for `@scope/core`. |

## Development
<!-- product repos; library repos put this in CONTRIBUTING.md -->

```sh
pnpm install
pnpm services     # Redis and MinIO in Docker
pnpm dev          # dashboard on :5173, server on :4000
```

| App | Directory | Run alone | URL |
| --- | --- | --- | --- |
| Dashboard | `apps/dashboard` | `pnpm --filter @scope/dashboard dev` | http://localhost:5173 |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License
````

Rules:

- **Tables list what's on disk.** Every row links a folder that exists; no rows for removed or
  renamed packages. A stale index (uv's `crates/README.md` listed 32 of ~90 crates under old
  names) is worse than none, so only add a table someone will keep current, and prefer
  publishing-relevant packages over every internal one.
- **Commands come from the root `scripts`.** If the root has `"dev": "turbo run dev"`, the README
  says `pnpm dev`, not `npx turbo dev`. Ports come from each app's dev script.
- **When the root and the main package say the same thing**, make one the source of truth: the
  AI SDK and Next.js symlink the root README to the main package's README, and tokio keeps two
  copies identical with a `diff` in CI. Otherwise they drift (pnpm's root calls the Rust port
  "experimental" while its own README calls it "the target for new feature development").
- **Sponsors, partner logos and contributor walls go below the content.**

## Published package README

This file becomes the package's page on the registry, often read without the repo around it.

````markdown
# @scope/pkg

[![npm](https://img.shields.io/npm/v/@scope/pkg)](https://www.npmjs.com/package/@scope/pkg)
[![CI](https://github.com/org/repo/actions/workflows/ci.yml/badge.svg)](https://github.com/org/repo/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/@scope/pkg)](https://github.com/org/repo/blob/main/packages/pkg/LICENSE)

One sentence that names the parent project and what this package adds. Effect: "An Effect SQL
client for Cloudflare D1, for use in Cloudflare Workers."

## Install

```sh
npm install @scope/core @scope/pkg
```

Peer requirements with versions, if constrained: "Requires React 19 and `@scope/core` 2.x."

## Usage

```ts
// 5-15 lines that run against the published API
```

## Documentation

[Docs](https://example.dev/pkg) · [API reference](https://...) · [Changelog](https://github.com/org/repo/blob/main/packages/pkg/CHANGELOG.md)

## License

MIT
````

Rules:

- **Badges name this package.** Each published package gets its own badge row (version, CI from
  the repo's test workflow, license; see
  [project-types.md](project-types.md#badges-for-npm-packages)), with its own scoped name in
  every URL. The monorepo root, apps and private packages get no npm badges.
- **The H1 and the install line use the exact `name` from `package.json`.** Turborepo's template
  ships `# @turbo/eslint-config` for a package named `@repo/eslint-config`; cal.com's
  `@calcom/embed-react` README is titled "cal-react".
- **Install the peers too**, the way readers need them: `npm install effect @effect/sql-d1`,
  `npm i ai @ai-sdk/openai`.
- **Use absolute URLs** for every link and image that points outside the package directory.
  Registries render the README without the repo, so `../../docs/guide.md` breaks on npm. Use the
  `repository` field's URL with `/blob/main/<directory>/...`.
- **Say whether outsiders should use it.** The AI SDK's `provider-utils`: "Applications rarely
  need to depend on this package directly." uv's crates: "This crate is an internal component
  of uv. The Rust API exposed here is unstable and will have frequent breaking changes." Astro's
  internal helpers: "This package does not follow semver and should not be used externally."
- **Deprecations and migration notes go first**, where registry readers look (tRPC's `@trpc/next`
  opens with "Deprecated: `createTRPCNext` and `withTRPC`").
- **No contributor notes** (cal.com shipped "TODO ... How to solve it?" to npm), **no workspace
  setup** ("clone the repo and run pnpm install"), and **no sales or cross-sell block** copied into
  every package (Effect's "Let's talk" block appears word for word in every package README,
  sometimes above the only real content).
- **A docs-site stub is fine if it still has the install line and one sentence of purpose.**
  Astro's integration READMEs and TanStack's `react-query` README link to docs but never say how
  to install the package. TanStack's `query-core` has no README, so its npm page is blank.
- **If the README is generated per release, say so** in a comment and pin version and source
  links to the release tag, as uv does.
- **Template the frame, not the content.** Changesets copied one badge into every package, so
  every package's "View changelog" badge shows the CLI's version; pnpm's git-resolver example
  still names its variable `createResolveFromNpm`. When you write several package READMEs,
  write each one from that package's own code, and run the checker on all of them together
  so copied sentences show up (`copied-sentence`).

## Internal package README

The default for pure config packages (`tsconfig`, `eslint-config`, `tailwind-config`,
`prettier-config`) is **no README**. When one exists, it's usually create-turbo's stub ("These
are base shared `tsconfig.json`s from which all other `tsconfig.json`'s inherit from."), copied
verbatim into cal.com, Documenso and Supabase. Delete it, or replace it with the one fact a
teammate needs:

````markdown
# @tally/tsconfig

Shared TypeScript configs. Extend one from a package's `tsconfig.json`:

```json
{ "extends": "@tally/tsconfig/react-library.json" }
```

`node.json` is for services; `react-library.json` adds JSX and bundler resolution.
````

Write a fuller one when the package has an API other packages consume or rules people break.
Supabase's `packages/ui` is the model: its purpose, the import path (`import { Badge, Button,
Input } from 'ui'`), which components to prefer, and where the real config lives ("The
workspace root owns the actual `tailwind.config.js`. The file in this package is a stub for
IntelliSense only.").

````markdown
# @tally/ui

React components shared by `apps/dashboard` and `apps/admin`. Private, consumed as `workspace:*`.

```tsx
import { Button, Dialog } from '@tally/ui'
```

Conventions a newcomer would miss.

```sh
pnpm --filter @tally/ui test
```
````

Never write `npm install @tally/ui` for a private package: it isn't on the registry.

## App README

Delete the scaffolder's README ("This is a [Next.js](https://nextjs.org) project bootstrapped
with `create-next-app`", "This Turborepo starter is maintained by the Turborepo core team"). In
the Turborepo template, `apps/web` and `apps/docs` have byte-identical create-next-app READMEs
saying `localhost:3000`, while the docs app's script runs `next dev --port 3001`.

The replacement answers: what is this app, and how do I run just this one from the root?

````markdown
# @tally/dashboard

The team dashboard for Tally: shows survey results streamed from `apps/server`. Vite and React.

## Run

From the repo root:

```sh
pnpm install
pnpm services                         # the server needs Redis
pnpm --filter @tally/dashboard dev    # http://localhost:5173
```

`apps/server` must be running for results to load (`pnpm dev` at the root starts both).

## Environment

Copy `.env.example` to `.env.local`.

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SERVER_URL` | yes | Base URL of `apps/server`, `http://localhost:4000` locally |
| `VITE_POSTHOG_KEY` | no | Analytics; leave empty to disable |

## Depends on

`@tally/ui` for components and `@tally/client` for server calls, both from this workspace.
````

Rules:

- **Say which directory each command runs from**, and use the root's package manager throughout
  (Supabase's Studio README mixes `pnpm run dev` and `npm run dev`).
- **Filter by the real package name or path**, with a syntax the package manager supports. npm
  has no `--filter` (Documenso's `npm run dev --filter=@documenso/docs` doesn't do what it says);
  it uses `-w <workspace>`. pnpm uses `--filter <name>`, Yarn uses `yarn workspace <name>`, turbo
  uses `--filter=<name>`.
- **The port is the one the dev script sets**, or the framework default when the script sets
  none.
- **Env vars come from `.env.example` and the config loader**, with cross-app constraints spelled
  out (cal.com: "make sure that the value of `NEXTAUTH_SECRET` is the same in both the root
  `.env` and in the api v2 `.env`").
- **Say when a change elsewhere needs a restart or rebuild**, if it does (cal.com: "if any of
  them change you might need to restart api v2").
- A deployable that isn't an npm package (a Stripe app, a worker) can have an operational
  runbook as its README: Dub's `stripe-app` lists the exact publish steps.

## Where contributor material goes

Shared mechanics go in one CONTRIBUTING.md (or DEVELOPERS.md) at the root: install, filter
commands, running one package's tests, changesets, the app/port table, release steps. Astro,
TanStack, pnpm and tRPC all do this, and their package READMEs don't repeat any of it.
Supabase's DEVELOPERS.md has the best app table found: site, directory, scope name, description
and local URL in one row.

If no CONTRIBUTING.md exists and the user didn't ask for one, keep a short Development section
in the root README and say in your report that a CONTRIBUTING.md would be the better home.

## Drift: the most common defect

The most common README defects in monorepos are ones nothing checks: a wrong port, a wrong
package name, a filter command that doesn't work, two package managers in one file, a private
package described as new, renamed crates in an index, a root README that contradicts the
subproject's. Run `scripts/check-readme.mjs` over every README you touched, from the repo, and
read the facts the script can't check (option names, behaviour) against the code.
