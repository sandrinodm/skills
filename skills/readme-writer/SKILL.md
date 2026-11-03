---
name: readme-writer
description: >-
  Write, rewrite and review README files that read like a maintainer wrote them instead of a
  template or a model: every command run, every claim traced to the code, a real npm badge row
  instead of a badge wall, no emoji headings, adjective feature lists or invented benchmarks. Covers
  root READMEs for libraries, CLIs, frameworks, apps and internal services, and READMEs inside
  monorepos (the root, published packages that become the npm page, internal packages, and apps like
  apps/web or apps/api). Use it whenever the user asks to write, create, improve, clean up, fix or
  review a README or package README; to document a new package or app in a workspace; to replace
  create-next-app, create-turbo or other scaffolder READMEs; to prepare a package for publishing; or
  when a README sounds AI-generated or out of date. Includes a checker script for broken links,
  missing scripts, wrong ports and package names, and common slop. SKIP: docs-site pages, API
  reference generation, CHANGELOGs, blog posts, code comments.
---

# README Writer

A README is the front door. Its reader decides in under a minute whether the project fits, so
the README's job is to let them decide fast: what this is, what using it looks like, how to get
it, and where the rest lives. Generated READMEs fail the same few ways: sentences that would fit
any project, sections that exist because a template had them, and commands nobody ran. This skill
starts from what the repo proves and writes only that.

## What to read for the task

| Task | Do | Read |
| --- | --- | --- |
| New root README | [Workflow](#workflow), [rules](#the-rules) | [project-types.md](references/project-types.md) for the skeleton and real examples |
| Rewrite a README that reads as generated | Workflow, rules | [slop.md](references/slop.md) |
| READMEs in a monorepo (root, packages, apps) | Workflow, rules, [monorepo summary](#monorepos) | [monorepo.md](references/monorepo.md) |
| Review a README without changing it | [Review](#reviewing-a-readme) | [slop.md](references/slop.md) |
| Small edit (add a section, update install) | Match the existing README's voice; rules 2, 5 and 6 still apply | Nothing extra |

## Workflow

1. **Read the repo before writing.** Manifests (`package.json` `name`, `description`, `bin`,
   `exports`, `scripts`, `engines`, `license`, `private`; `Cargo.toml`; `pyproject.toml`), the
   lockfile (it picks the package manager), entry points and exports, `examples/`, tests (the
   best source of real usage), the CLI's argument parser or `--help`, `.env.example` and the
   config loader, `Dockerfile` and `docker-compose.yml`, CI workflows, LICENSE, CONTRIBUTING.md,
   CHANGELOG, any docs site, and the existing README with its git history. In a monorepo, map
   the workspace first (see [monorepo.md](references/monorepo.md#before-writing-map-the-workspace)).
2. **Keep a fact ledger.** For each fact you plan to use, note where it came from: the file, the
   command you ran, or the user. Facts with no source stay out of the README and go into your
   report as questions. This matters most for numbers, compatibility, status ("stable",
   "production-ready"), support channels, links and anything the old README claims.
3. **Pick the reader and the type.** One README, one primary reader: users of a library, users of
   a CLI, self-hosters of an app, teammates running a service. Pick the skeleton for that type
   from [project-types.md](references/project-types.md), then delete every section you have no
   facts for. Contributor material (release steps, repo tree, CI secrets) goes in
   CONTRIBUTING.md, with a link left in the README.
4. **Run what you'll show.** Install the package or run the CLI from a scratch directory, run the
   example, and copy the real output into `//=>` comments or a console transcript. Check that
   every script, filter, path and port exists. If something can't run here (needs secrets,
   network, hardware, a paid service), keep only what the source proves and list it as
   unverified in the report.
5. **Write it**, following the rules below.
6. **Check it.** Run `node scripts/check-readme.mjs <every README you touched>` from anywhere,
   passing all of them in one call so copied sentences between siblings show up. Fix every
   `error`. Fix each `slop` finding, or keep it deliberately and say why in the report. Then
   reread once as a newcomer against [slop.md](references/slop.md): the script can't tell
   whether an option name, a described behaviour or a comparison is true. Only reading the code
   can.
7. **Report.** Say what you verified and how (the commands you ran and their results), what you
   couldn't verify, what you removed or moved from the old README and why, and open questions
   for the maintainer (missing LICENSE file, a manifest `description` that disagrees with the
   README, an unpublished package name). Offer to update the manifest description or add a
   CONTRIBUTING.md rather than doing it unasked.

**Rewriting an existing README**: keep what's true and the maintainer's voice (first person,
jokes, a pronunciation note). Recheck every claim against the code rather than carrying it
over. Move sponsor walls, testimonials and star charts below the usage instead of deleting
them, and list the moves. Before restructuring, check whether anything depends on the README's
text: a docs site that includes it, tests that grep it, a `files` entry, a symlink from the root.

## The rules

1. **Open with what it is, in plain words.** One or two sentences: "X is a <category> that
   <does what, how>." Name the mechanism and what it's like or replaces ("an alternative to
   `find`", "like Lodash for dates"). Scope it honestly ("does not aim to support all of `find`'s
   functionality"). Keep the one-liner under ~120 characters and in line with the manifest
   `description`. No slogan without a definition after it, and no "Welcome to".
2. **Show it working before explaining it.** The first code block or command comes within the
   first screen (about 40 lines). Use the smallest complete example that does the main job,
   with its output shown. For apps, show a screenshot or demo link. The example must be one you
   ran, or one you read line by line against the exports. Output (`//=>` comments, console
   transcripts) is copied from a real run, never typed from what it would probably print. If you
   couldn't run it, show the calls without output and say so in the report.
3. **Every claim is checkable, or it goes.** Apply the portability test: if a sentence would
   fit another project's README unchanged, replace it with this project's fact or delete it.
   "Fast" needs a benchmark in the repo that names the workload. "Zero dependencies" needs an
   empty `dependencies`. "Works in Deno" needs a test or docs. A comparison says when to use
   the other tool. Never invent numbers, users, compatibility, roadmap items or quotes.
4. **Only sections the project has material for.** No Roadmap without a roadmap, no Support
   without a channel, no FAQ of imagined questions, no Acknowledgments with nothing in them, no
   "Prerequisites: Node.js and npm". Contributing links CONTRIBUTING.md or gives the dev
   commands; "PRs welcome!" alone is not a section. License is one line naming the license and
   linking the file. If the LICENSE file is missing, tell the user instead of linking it.
5. **Commands come from the repo, not from memory.** Use the lockfile's package manager
   throughout. Use scripts that exist, filters that match real workspace names, the port the dev
   script sets, env vars from `.env.example`, the Node version from `engines` or `.nvmrc`, and CLI
   flags from the parser. Say which directory a command runs from when it isn't the obvious one.
6. **Plain formatting.** One H1. Sentence-case headings without emoji. No emoji bullets, no
   horizontal rules between sections, and no hand-written table of contents in a short README
   (GitHub renders one). Bold only for a real warning. Badges: only ones a reader acts on, and
   each one backed by something real. Never stars, "PRs welcome", "made with TypeScript", or
   static badges that imitate live status ("build passing").
7. **Lists for list-shaped content, sentences for explanation.** A feature list says what you
   can do, concretely, ideally naming the API ("`retry()` backs off exponentially, capped at
   `maxDelay`"). Never use "**Fast**: Built for speed." Options, env vars, commands and packages
   go in tables. Explanations are prose.
8. **Write like a maintainer explaining it to a colleague.** Short declarative sentences,
   "you", present tense. Call the project by one name throughout. No section preambles ("This
   section covers"), no closing summary, no sign-off ("Happy coding!"), no chat phrases ("Feel
   free to"), no "not just X but Y", no triads for rhythm, no rhetorical questions. Use few em
   dashes, but don't swap every one for a comma splice. Keep the project's existing voice and
   spelling.
9. **Link instead of duplicating.** When a docs site exists, the README stays short and links
   into it by topic. Each fact has one home: the README doesn't restate CONTRIBUTING.md, the
   CHANGELOG, the LICENSE or the docs. No file-tree dump of every file. If the layout matters to
   contributors, a short table of top-level folders goes in CONTRIBUTING.md.
10. **Be honest about status.** Deprecated, unmaintained, experimental, "for the unreleased next
    version", or a non-permissive license goes at the top, with the replacement if there is one.
    Remove stale "NEW" banners.
11. **Write package READMEs for the registry page.** A published package README is read on npm,
    crates.io or PyPI without the repo around it. Put the exact manifest name in the H1 and the
    install line, install required peers in the same command, and use absolute URLs for
    images and for links that leave the package directory. npm only resolves relative links
    (`LICENSE`, `docs/usage.md`) through the manifest's `repository` field. When it's missing,
    link badges to the npm page, keep the License line's relative `[LICENSE](LICENSE)` link (it
    works on GitHub and in the installed package), and ask the maintainer to add the field.
12. **Give every npm package a badge row.** One line directly under the H1, in this order:
    the npm version (always, even before the first publish), then CI if a workflow in
    `.github/workflows` runs the tests, then the license if the manifest declares one. After
    that, add at most two that fit: monthly downloads once the package has real usage, bundle
    size for a browser library, or the Node version when `engines.node` is a real constraint.
    Build every URL from the manifest `name`, the `repository` field and the workflow's file
    name, never from memory. The exact markdown is in
    [project-types.md](references/project-types.md#badges-for-npm-packages). Apps, internal
    services, private packages and monorepo roots get no npm badges.

## Monorepos

Each README has its own reader. Details, skeletons and real examples are in
[monorepo.md](references/monorepo.md).

| README | Contains | Leaves out |
| --- | --- | --- |
| Root | What the project is, the main install or quick start, a package table when users choose between packages, local development for product repos, links to CONTRIBUTING.md and docs | Each package's docs, scaffolder text |
| Published package | Badge row for its own name (version, CI, license), exact scoped name, one sentence naming the parent project, install with peers, a short working example, absolute links to docs, API and changelog, whether outsiders should depend on it | Workspace setup, contributor notes, blocks copied into every package |
| Internal package | Usually nothing for config packages. Otherwise who consumes it, the import or `extends` line, conventions | `npm install` (it isn't published), boilerplate |
| App (`apps/*`) | What the app is, the run command from the root with the real filter and port, env vars from `.env.example`, services and workspace packages it depends on | create-next-app or create-turbo text, other package managers |

Workspace mechanics (filters, per-package tests, changesets, the app and port table) live in one
root CONTRIBUTING.md or DEVELOPERS.md, not in every package.

## Reviewing a README

When asked to review rather than rewrite, don't edit the file. Run the checker, read the README
against the code, and report findings ranked by how much they would hurt a reader, each with
`path:line`:

1. Wrong facts first: commands, names, options, ports and links that don't match the repo, and
   claims with no source.
2. Then missing essentials: no definition, no example, no install, no status warning.
3. Then structure: audience mixing, duplication, sections without material.
4. Then slop: wording and formatting habits from [slop.md](references/slop.md).

For the top findings, show the current text next to a proposed rewrite. Offer to apply them.

## Script

`scripts/check-readme.mjs` (Node 18+, no dependencies) checks one or more READMEs against the repo
around them:

- **error**: relative links and `#anchors` that don't resolve; `npm`/`pnpm`/`yarn`/`bun` scripts,
  `--filter` targets, turbo tasks (also run as `pnpm turbo` or `npx turbo`), make and just
  targets, `cd` directories and script paths that don't exist; a package manager other than the
  lockfile's; `npm --filter`; install commands or H1s with the wrong package name; `npm install`
  for a private package; imports of names the package doesn't export; npm badges for another
  package, CI badges for a workflow that doesn't exist or another repo, license badges that
  contradict the manifest; a documented port that differs from the dev script; a License section
  with a different license from the manifest; "zero dependencies" with dependencies; placeholders
  (`your-username`, `[Project name]`, `2025-XX-XX`); scaffolder boilerplate.
- **slop**: emoji headings and bullets, marketing words, chat and summary phrases, bold-label
  bullet lists, badge walls (more than six), static status badges, star and "made with" badges,
  horizontal-rule overuse, em-dash density, empty Contributing sections, conclusion headings.
- **note**: title-case headings, a first code block after line 80, a short README with a
  hand-written table of contents, a License section with no LICENSE file, `.env.example`
  variables the README never mentions, a published package whose name never appears or that has
  no npm version badge, and sentences copied across several of the READMEs checked.

The checks live in `scripts/check-readme/`, one module per concern, with `node:test` tests beside
them (`cd scripts && node --test`).

```sh
node scripts/check-readme.mjs README.md packages/*/README.md apps/*/README.md
node scripts/check-readme.mjs --style-only draft.md     # no repo checks
node scripts/check-readme.mjs --json README.md
```

It exits 1 when there's an error or slop finding, and 2 for no files or an unknown option. A clean
run doesn't prove the README is right: it doesn't know whether an option exists or a sentence is
true. That's step 6's reread.
