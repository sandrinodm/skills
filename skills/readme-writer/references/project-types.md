# Root READMEs by project type

What well-regarded projects put in their root README, by project type, with examples from
projects known for good documentation. Skeletons are starting points: drop any section the
project has nothing true to say in.

## Contents

- [Choosing the type](#choosing-the-type)
- [How to open](#how-to-open)
- [The first example](#the-first-example)
- [Library with a docs site](#library-with-a-docs-site)
- [Small library or utility (the README is the docs)](#small-library-or-utility-the-readme-is-the-docs)
- [CLI tool](#cli-tool)
- [Framework, runtime or build tool](#framework-runtime-or-build-tool)
- [Application (hosted or self-hosted)](#application-hosted-or-self-hosted)
- [Internal service or company repo](#internal-service-or-company-repo)
- [Source or infrastructure repo](#source-or-infrastructure-repo)
- [Why, why not, and benchmarks](#why-why-not-and-benchmarks)
- [Badges for npm packages](#badges-for-npm-packages)
- [Logos and the rest of the header](#logos-and-the-rest-of-the-header)

## Choosing the type

| Type | Typical length | First runnable thing by | Order |
| --- | --- | --- | --- |
| Library with a docs site | 40-220 lines | line ~45 | what it is, example, install, docs link |
| Small library, README is the docs | 150-450 lines, grows with the API | line ~15 | tagline, install, usage, API, FAQ |
| CLI with a docs site | 80-330 lines | line ~50 | what it is, install, one usage block, docs link |
| CLI, README is the manual | 400-1200 lines | line ~50 | what it is, nav row, scenarios, benchmarks, install per platform |
| Framework or runtime with a docs site | 35-110 lines | line ~30 | what it is, scaffold command, docs link, packages |
| Application | 120-230 lines | screenshot first | screenshot, what it replaces, features, hosted vs self-hosted, link to install docs |
| Internal service | 40-150 lines | line ~30 | what it does, who owns it, run it locally, config, deploy |

Long is fine when the README is the only documentation (fd, bat, ripgrep, ky). Short is right
when a docs site exists: Tailwind's README is 36 lines and esbuild's is 39. A README that copies
the docs homepage (FastAPI, 534 lines) or dumps a docs sitemap (Bun, ~350 lines of links)
duplicates content that will drift.

## How to open

The first sentence says what the project is, specifically enough that a reader can decide
whether to keep reading. Four shapes work, often combined:

1. **"X is a <category> that <mechanism>, <differentiator>."** Name the mechanism, not just the
   benefit.
   - jq: "`jq` is a lightweight and flexible command-line JSON processor akin to `sed`, `awk`,
     `grep`, and friends for JSON data. It's written in portable C and has zero runtime
     dependencies."
   - Litestream: "Litestream is a standalone disaster recovery tool for SQLite. It runs as a
     background process and safely replicates changes incrementally to another file or S3."
   - ripgrep: "ripgrep is a line-oriented search tool that recursively searches the current
     directory for a regex pattern. By default, ripgrep will respect gitignore rules and
     automatically skip hidden files/directories and binary files."
2. **A noun-phrase tagline with a hard number or constraint.**
   - clsx: "A tiny (239B) utility for constructing `className` strings conditionally."
   - nanoid: "A tiny, secure, URL-friendly, unique string ID generator for JavaScript." followed by
     "**Small.** 117 bytes (minified and brotlied). No dependencies."
3. **Anchored to something the reader knows.**
   - fd: "a simple, fast and user-friendly alternative to `find`."
   - date-fns: "It's like Lodash for dates."
   - ky: "Benefits over plain `fetch`" as the first section.
4. **A specific problem statement.**
   - esbuild: "Our current build tools for the web are 10-100x slower than they could be."

The best openings scope honestly. fd: "While it does not aim to support all of `find`'s powerful
functionality, it provides sensible (opinionated) defaults for a majority of use cases." SQLite:
"This README file is about the source code that goes into building SQLite, not about how SQLite
is used."

Openings that fail are slogans a reader can't act on: "Next Generation Frontend Tooling",
"Move fast and break nothing.", "Fast, but not only fast.", "easy to learn, fast to code, ready
for production". If the project has a slogan the maintainer likes, it can stay as the tagline,
but the definition sentence must follow right after it.

Keep the one-liner under about 120 characters and identical to (or a tightening of) the
`description` in the manifest and the GitHub "About" text. If they disagree, mention it in your
report so the maintainer can align them.

## The first example

Show the smallest complete thing that does the main job, and what it produces:

- **Result comments**: clsx, date-fns and nanoid annotate each call with `//=>` and the value, so
  the reader sees output without running anything.
  `model.id = nanoid() //=> "V1StGXR8_Z5jdHi6B-myT"`
- **A console transcript with real output**: uv shows `$ uv init example` followed by
  "Initialized project `example` at `/home/user/example`" and "Resolved 2 packages in 170ms".
  Capture this by running the command; never type output from memory.
- **The snippet plus a plain-English reading of it**: htmx shows a five-line button and then
  "When a user clicks on this button, issue an AJAX request to /clicked, and replace the entire
  button with the response".
- **Steps that end in something visible**: Deno's "This should start a local web server on
  http://localhost:8000.", Rails' "Go to `http://localhost:3000` and you'll see the Rails
  bootscreen".
- **A scenario**: fd's "assume that you want to find an old script of yours (the name included
  `netflix`)".
- **A screenshot or short recording** for apps and TUIs. Name the file for what it shows and give
  it alt text that says the same.

Write the example to a scratch file and run it against the real package before putting it in the
README. If it can't run (needs an API key, a device, a paid service), say in the report that it's
unverified and keep it to calls you read in the source.

## Library with a docs site

Models: Zod, Hono, Effect, date-fns.

````markdown
# name

<!-- badge row: npm version, CI, license; see "Badges for npm packages" -->

One-line definition. Optional second sentence with the differentiator.

[Documentation](https://...) · [API reference](https://...) · [Examples](./examples)

```ts
// 5-15 lines that do the main thing, with output shown
```

## Install

npm install name

Requirements, only if real: TypeScript 5.4+ with `strict`, Node 20+, a peer dependency.

## Documentation

One line linking the site, or a few links into its main sections.

## Contributing / License

One line each.
````

Zod gets to code at line 43, Hono at 25. Effect's README has no code at all, which is its
weakest point: a reader learns the pitch but not what Effect code looks like.

## Small library or utility (the README is the docs)

Models: p-limit, clsx, nanoid, ky.

````markdown
# name

<!-- badge row: npm version, CI, license, bundle size for browser libraries -->

> One-line description, with the size or constraint if that's the point.

Works in Node.js 18+ and browsers.   <!-- only if checked -->

## Install

npm install name

## Usage

```js
import limit from 'name'
// annotated example, //=> results
```

## API

### `fn(input, options?)`

What it returns, what it throws. Then each option: type, default, one line.

## FAQ / Comparison

"How is this different from p-queue?" Only questions people actually ask; check the issues.

## Related

Sibling packages, alternatives.

## License
````

p-limit reaches Install at line 9 and Usage at 13. The API section is the bulk of the file, and
that's correct here: there is nowhere else for it to live.

## CLI tool

Models with a docs site: uv, Deno, jq. Models where the README is the manual: ripgrep, fd, bat.

````markdown
# name

One or two sentences: what it does, its defaults, what it's an alternative to.

Optional: a screenshot or benchmark chart whose caption names the workload.

## Install

The recommended command first (Homebrew, cargo, npm -g, a curl script), then other platforms.
Long per-distro lists go at the end or in a separate INSTALL.md.

## Usage

```console
$ name some-input
<real output>
```

A few scenarios, each a heading or bold lead and a command. Show the flags people need on
day one, not all of them; link `name --help` or the man page for the rest.

## Configuration    <!-- only if there's a config file -->

## Documentation / Contributing / License
````

For the README-as-manual variant, keep install reachable from the top with a one-line nav row
(fd: `[Installation](#installation) • [How to use](#how-to-use) • [Troubleshooting](#troubleshooting)`),
and add Troubleshooting and "Integration with other programs" sections if the issues show people
need them.

Take flags and exit codes from the argument parser or `--help`, and run every command you show.

## Framework, runtime or build tool

Models: Deno, Hono, Astro, Rails, Tailwind, esbuild.

````markdown
# name

One-line definition.

```sh
npm create name@latest       # or the hello-world: 5 lines and the command to run it
```

What you see when it works ("open http://localhost:4321").

## Documentation

## Packages     <!-- monorepos: a table, one line per package, see monorepo.md -->

## Contributing / License
````

These READMEs are short because the docs site carries the weight. Rails is a useful longer model:
it explains its parts (Model, View, Controller layers) in a paragraph each, then gives numbered
Getting Started steps.

## Application (hosted or self-hosted)

Models: Excalidraw, Plausible, Immich, Ghostty.

````markdown
# name

One line: what it is and what it replaces. ("Lightweight, cookie-free alternative to Google
Analytics.")

[Live app](https://...) · [Docs](https://...) · [Download](https://...)

![Screenshot of the dashboard showing ...](docs/screenshot.png)

A short paragraph on why it exists or who it's for.

## Features       <!-- concrete, grouped by area; platform columns if web and mobile differ -->

## Hosted vs self-hosted     <!-- if both exist, compared honestly -->

## Self-hosting / Development   <!-- link the docs, or the minimal docker compose steps -->

## Contributing / Translations / License
````

Applications don't show code first; they show the product. A demo with public credentials
(Immich: `demo@immich.app` / `demo`) is the best possible quick start. Plausible answers the
question buyers actually ask: "Why is Plausible Analytics Cloud not free like Google Analytics?"

## Internal service or company repo

The same rules apply with a different reader: a teammate who has to run, change or debug the
service.

````markdown
# name

What the service does, in one or two sentences, and who calls it.

Owner: #team-channel · On-call: link · Dashboards: link   <!-- only real ones -->

## Run it locally

Prerequisites that aren't obvious (Docker for Postgres, access to a vault path), then the exact
commands and the URL or port it listens on.

## Configuration

| Variable | Required | Default | Purpose |
<!-- from .env.example and the config loader, not from memory -->

## Tests / Deploy

The commands, and where deploys happen (CI workflow name, environment).
````

## Source or infrastructure repo

Models: SQLite, curl. Say what this README covers and what it doesn't, then: how to get and verify
the source, how to build, a map of the source tree if it's large, where to report security
problems, and how to reach the maintainers. curl's README is 66 lines and contains no usage at all,
because usage lives in the man page and "everything curl"; it says so.

## Why, why not, and benchmarks

These sections earn their space when they're specific and fair.

- **Say when not to use it.** ripgrep's "Why shouldn't I use ripgrep?": "You need a portable and
  ubiquitous tool. While ripgrep works on Windows, macOS and Linux, it is not ubiquitous and it
  does not conform to any standard such as POSIX. The best tool for this job is good old grep."
  p-limit's FAQ points readers to p-queue when they need a full queue.
- **Benchmarks name the corpus, hardware, versions and exact commands**, include cases where the
  project loses, and link the script that produced them. fd: "Let's search my home folder for
  files that end in `[0-9].jpg`. It contains ~750,000 subdirectories and about a 4 million files.
  For averaging and statistical analysis, I'm using hyperfine." ripgrep: "Please remember that a
  single benchmark is never enough!" A chart caption names the workload (uv: "Installing Trio's
  dependencies with a warm cache").
- **Never write a benchmark the repo doesn't contain.** No "10x faster", no "<1ms", no
  "up to 300%". If the maintainer has numbers, ask for the script.
- **Comparisons use numbers, not adjectives.** nanoid vs UUID: "It has a similar number of
  random bits in the ID (126 in Nano ID and 122 in UUID)".
- **Motivation can be a story.** xsv: "the impetus for this project was a 40GB CSV file that was
  handed to me." It's specific, so it reads as human.

## Badges for npm packages

Every README for a package published (or about to be published) to npm gets a badge row. The
badges popular npm libraries use most are the npm version, monthly downloads, CI status,
coverage, bundle size and license. The ones with a clean row keep it to two to five: tsx, ofetch
and h3 show version and downloads; Prisma shows license, version and CI; zustand shows CI, size,
version and downloads. A typical row for a Node CLI:

```markdown
# pkg-name

[![npm](https://img.shields.io/npm/v/pkg-name)](https://www.npmjs.com/package/pkg-name)
[![CI](https://github.com/owner/pkg-name/actions/workflows/ci.yml/badge.svg)](https://github.com/owner/pkg-name/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/pkg-name)](LICENSE)
[![node](https://img.shields.io/node/v/pkg-name)](package.json)
```

Put the row directly under the H1, one badge per line in the source (it renders as one row),
in this order. Fill each placeholder from the repo:

| Badge | When | Markdown |
| --- | --- | --- |
| npm version | Always, for a published or about-to-be-published package | `[![npm](https://img.shields.io/npm/v/NAME)](https://www.npmjs.com/package/NAME)` |
| CI | A workflow in `.github/workflows` runs the tests on the default branch | `[![CI](https://github.com/OWNER/REPO/actions/workflows/FILE.yml/badge.svg)](https://github.com/OWNER/REPO/actions/workflows/FILE.yml)` |
| License | The manifest has a `license` field | `[![license](https://img.shields.io/npm/l/NAME)](LICENSE)`, or a static `license-MIT-blue` badge |
| Downloads | Optional: the package has real usage, not a 0.x release nobody installs yet | `[![downloads](https://img.shields.io/npm/dm/NAME)](https://www.npmjs.com/package/NAME)` |
| Bundle size | Optional: a library that ships to browsers | `[![size](https://img.shields.io/bundlejs/size/NAME)](https://bundlejs.com/?q=NAME)` (more reliable than bundlephobia's badge, which often shows "rate limited") |
| Node version | Optional: `engines.node` is a real constraint (Node 22+, 24+) | `[![node](https://img.shields.io/node/v/NAME)](package.json)` |
| JSR | Also published to JSR | `[![JSR](https://jsr.io/badges/@SCOPE/NAME)](https://jsr.io/@SCOPE/NAME)` |

How to fill them in:

- **NAME** is the manifest `name`, exactly. Scoped names go in as they are:
  `https://img.shields.io/npm/v/@effect/sql-pg`. In a monorepo, each package's badges use that
  package's own name. Changesets copied one package's badge into every package README, so every
  package shows the CLI's version.
- **OWNER/REPO** comes from the `repository` field. **FILE.yml** is the workflow's file name in
  `.github/workflows`; pick the one that runs the tests, not the publish workflow. With no
  workflow, there is no CI badge.
- **Link targets**: the version and downloads badges link to the npm page, CI to the workflow
  runs, license to the LICENSE file. A package README is shown on npm, so make the LICENSE link
  absolute there (`https://github.com/OWNER/REPO/blob/main/packages/pkg/LICENSE`). npm turns a
  relative link into a repo link only when the manifest has a `repository` field; without one,
  `(LICENSE)` and `(package.json)` are broken on the npm page. Then link every badge to the npm
  page, keep the License line's `[LICENSE](LICENSE)` link (it still works on GitHub and in the
  installed package), and say in the report that the field is missing.
- **Before the first publish** the npm badges render as "package not found". Add them anyway:
  they fix themselves on publish. Say so in your report.
- **Dynamic beats static** when both exist (`npm/l/NAME` reads the license from the registry).
  A static badge is fine only when it repeats a fact from the manifest (license, Node version)
  and matches it. A static badge for something that changes ("build passing", "coverage 100%")
  is a lie the moment it changes.

Never add: stars, "PRs welcome", "made with TypeScript" or other language badges ("Type
definitions are included" in the text says more), "maintained: yes", last commit, commit
activity, contributors count, code style, Gitpod, all-contributors, or more than six badges in
total. Hono (11), Fastify (11) and Remeda (23) show where that ends.

## Logos and the rest of the header

- Projects that aren't npm packages often do best with no badges at all: ripgrep has 3 (after
  the description), and jq, curl, Rails, esbuild and Ghostty have none.
- A logo is fine if the project has one. Use it with alt text that names the project
  (bat: "bat - a cat clone with wings").
- A one-line nav row under the title (esbuild: "Website | Getting started | Documentation |
  Plugins | FAQ") is the cleanest way to delegate to a docs site.
- Sponsors, merch, testimonials, star history and contributor walls go at the end. execa's
  first real sentence is at line 62, below 45 lines of sponsor HTML; fzf opens with a merch
  block. Don't reproduce that, and when rewriting, move such blocks down and say so.
- Status notices go at the top when they change whether someone should use the project:
  deprecation, "unmaintained" (xsv's H1 is "`xsv` is now unmaintained" and names replacements),
  "this README is for the unreleased next version" (ky), or a non-permissive license.
- Remove stale announcements: date-fns still opens with "🔥️ **NEW**: date-fns v4.0 with
  first-class time zone support is out!" two years after the release.
