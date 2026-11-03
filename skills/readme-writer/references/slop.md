# What makes a README read as generated

A model writes the most likely next sentence. A maintainer writes the one sentence that is true
of this project and no other. Almost every tell below is a symptom of the first habit, so the
fix is nearly always the same: replace the sentence with a fact about this project, or delete
it.

`scripts/check-readme.mjs` catches the mechanical tells (marked **[checked]**). The rest need a
reread.

## Contents

- [Claims without evidence](#claims-without-evidence)
- [Words](#words)
- [Sentence shapes](#sentence-shapes)
- [Formatting](#formatting)
- [Template sections](#template-sections)
- [Invented facts](#invented-facts)
- [Monorepo-specific tells](#monorepo-specific-tells)
- [Don't over-correct](#dont-over-correct)
- [A full rewrite](#a-full-rewrite)

## Claims without evidence

**The portability test.** If a sentence could be pasted unchanged into another project's README
and still make sense, it says nothing. Replace it with the specific fact, or delete it.

| Generated | Rewritten from the repo |
| --- | --- |
| A powerful, flexible tool for modern developers. | Runs your `package.json` scripts across every workspace package, in dependency order, and caches the output. |
| Built with performance in mind. | Parses a 1 GB log file in 2.1 s on an M2 (see `bench/parse.ts`). |
| Seamlessly integrates with your existing workflow. | Reads the same `.eslintrc` your editor already uses. |
| Lightweight and easy to use. | 1.2 kB gzipped, no dependencies. One function: `retry(fn, options)`. |
| Designed for scalability. | (delete: nothing in the repo shows it) |
| Production-ready. | (delete, or: "Used in production at Acme since 2024" if the maintainer says so) |

A quality claim is fine when the same sentence proves it. ripgrep: "By default, ripgrep will
respect gitignore rules and automatically skip hidden files/directories and binary files." uv
and Ruff put "extremely fast" next to a benchmark chart whose caption names the workload
("Linting the CPython codebase from scratch").

## Words

These words claim a quality without showing it, or are favourites of a model era. **[checked]**
Each hit is a prompt to rewrite the sentence, not to swap in a synonym: "robust" becomes "retries
failed requests three times with backoff", not "resilient".

seamless, robust, powerful, blazing fast, lightning-fast, cutting-edge, state-of-the-art,
best-in-class, world-class, next-generation, game-changing, revolutionary, comprehensive,
leverage, utilize, delve, empower, streamline, elevate, harness, effortless, supercharge,
unleash, holistic, pivotal, meticulous, showcase, tapestry, testament, vibrant, embark, foster,
paradigm, synergy, unparalleled, unprecedented, hassle-free, frictionless, intuitive, delightful.

Also watch (not checked, too common in honest prose): modern, simple, easy, lightweight, fast,
flexible, rich, elegant, beautiful, clean, enterprise-grade, production-ready, scalable,
extensible, out of the box. Keep one only when the next clause proves it ("simple: one
function, no options").

Copula avoidance is a quieter tell: "serves as", "stands as", "functions as", "boasts",
"features", "offers" where "is" or "has" would do. "Hono offers a router" is "Hono has a router",
or better, show the router.

## Sentence shapes

| Shape | Example | Fix |
| --- | --- | --- |
| Not X, but Y **[checked]** | "Not just a logger, but a complete observability layer." | Say what it is: "A logger that also exports traces to OTLP." |
| Triads for rhythm | "Fast, flexible, and fun." | Keep only the items you can show. Two is fine. One is often best. |
| Trailing -ing benefit **[checked]** | "Caches results, ensuring a seamless experience." | Stop at the fact: "Caches results for 60 s." |
| False breadth **[checked]** | "Whether you're a beginner or an expert..." / "From prototypes to production" | Name the actual reader, or drop it. |
| About the document **[checked]** | "This section covers installation." / "The table below compares..." | Delete. The heading already said it. |
| Heading restated | "## Installation" then "To install the package, follow these steps:" | Start with the command. |
| Summary closer **[checked]** | "In summary, X makes Y easy." / "## Conclusion" | Delete. Readers don't read to the end of a README to be summarized at. |
| Sign-off **[checked]** | "Happy coding! 🚀" / "Made with ❤️" / "Star ⭐ this repo" | Delete. |
| Chat residue **[checked]** | "Feel free to open an issue." / "Don't hesitate to reach out." / "Let's get started!" | "Report bugs in [issues](...)." |
| Rhetorical question | "Tired of slow builds?" | State the problem as a fact, with a number if you have one. |
| Synonym cycling | "the tool ... the library ... the solution ... the framework" | Use the project's name, or one noun, every time. |
| Hedged boilerplate | "may help improve", "can potentially" | Say what it does, or what it doesn't. |
| Throat-clearing | "It's worth noting that..." / "Importantly," | Delete the preamble and keep the fact. |

A problem statement is fine when it's specific. esbuild: "Our current build tools for the web
are 10-100x slower than they could be." htmx asks four rhetorical questions and gets away with it
because each one names a real HTML constraint. That's the bar.

## Formatting

- **Emoji in headings and bullets** **[checked]**: "## 🚀 Quick Start", "- ⚡ Fast". Remove them.
- **Bold-label bullet lists** **[checked]**: "- **Fast**: Built for speed." A quality as the label,
  then a sentence restating it. Write what each item does, ideally with the API name
  ("`retry()` backs off exponentially, capped at `maxDelay`"). Reference lists with an
  identifier label (`**cat** - Concatenate CSV files`) are fine.
- **Badge walls** **[checked]**: more than six badges. An npm package gets a short, real row
  (version, CI from a workflow that exists, license, maybe downloads or size; see
  [project-types.md](project-types.md#badges-for-npm-packages)). Drop stars, "PRs welcome",
  "made with TypeScript" **[checked]**, "maintained: yes", last commit, and static badges that
  imitate live status (`shields.io/badge/build-passing-green`) **[checked]**. A badge for another
  package, a missing workflow or a different license is wrong, not just noisy **[checked]**.
  Projects that aren't packages can go without: jq, curl and Rails have no badges.
- **Title Case Headings** **[checked as a note]**: "## Getting Started With The API". Use sentence
  case unless the project already uses title case everywhere.
- **Horizontal rules between sections** **[checked]**. Headings separate sections.
- **Hand-written table of contents** in a short README **[checked as a note]**. GitHub renders one
  from the headings. Long manual-style READMEs (fd, bat) can keep a one-line nav row instead.
- **Centered hero block**: `<p align="center">` logo, tagline, badge row and nav links. Fine
  for a project with a logo and a docs site; slop when it wraps a project with no logo, no
  site and three badges for nothing.
- **Bold for emphasis in prose**: at most one bold phrase per section, for a real warning.
- **More than one H1** **[checked as a note]**.
- **Star-history charts, "contributors" image grids** above the usage. If the maintainer wants
  them, they go at the very end.

## Template sections

A section exists because the project has something to put in it, not because a template had a
slot for it.

| Section | When it belongs | When it's slop |
| --- | --- | --- |
| Features | The project does several distinct things a reader chooses between (uv's Projects / Scripts / Tools, each with a transcript). | Three to six bullets of adjectives. Show the example instead. |
| Prerequisites | A real, non-obvious requirement: "Node 20+ (uses `fetch` and `node:test`)", Docker for the database, a Cloudflare account. | "Node.js and npm installed." |
| Roadmap | The repo has a roadmap file, milestones or a pinned issue. | Invented checkboxes. |
| FAQ | Questions people actually asked (issues, discussions). p-limit: "How is this different from the p-queue package?" | Questions the writer imagined. |
| Support / Contact | A real channel: Discord link, discussions, security email. | "Open an issue if you need help!" |
| Contributing | A link to CONTRIBUTING.md, or the dev commands (install, test, lint) when there's no such file. **[checked]** | "Contributions are welcome! Please open a PR." |
| License | One line: "MIT, see [LICENSE](LICENSE)." | A paragraph restating the license, or a license with no LICENSE file **[checked]**. |
| Acknowledgments | Real credit: a port of another project, a funder, borrowed code. | "Thanks to all contributors!" |
| Project structure | Rarely. Contributors need it, and it belongs in CONTRIBUTING.md. | A tree of every file with a comment on each. |
| Tech stack | An app whose stack a self-hoster must know (Postgres, Redis, S3). | A list of badges for React, TypeScript, Tailwind. |

## Invented facts

The worst slop is wrong, not ugly. Never write any of these without a source in the repo or
from the user:

- Numbers: speedups, sizes, test coverage, user counts, uptime, "zero dependencies" (check the
  manifest).
- Compatibility: Node versions (use `engines` or `.nvmrc`), browsers, OSes, runtimes ("works in
  Deno and Bun" only if tested or documented).
- Install commands for a package that isn't published, or under a name that isn't the
  manifest's **[checked]**.
- Scripts, `--filter` names, make targets and turbo tasks that don't exist **[checked]**.
- Env vars, ports and URLs: read them from the code, `.env.example` and config.
- CLI flags: run `--help`, or read the argument parser.
- API names and signatures: read the exports, or run the example.
- Links to a docs site, Discord or demo that don't exist; relative links to missing files
  **[checked]**.
- Placeholders: `your-username`, `[Project name]`, `<your-api-key>` in prose, `2025-XX-XX`
  **[checked]**.
- Badges for services that aren't set up (Codecov with no coverage upload, CI with no workflow).
- Status words: "stable", "production-ready", "actively maintained". Ask, or leave them out.

## Monorepo-specific tells

- **Scaffolder boilerplate left in place** **[checked]**: "This is a [Next.js](https://nextjs.org)
  project bootstrapped with `create-next-app`", "This Turborepo starter is maintained by the
  Turborepo core team", the create-vite "React + TypeScript + Vite" README. Replace it with what
  this app is and how to run it from the root.
- **The root README copied into every package**: same intro, same badges, same Contributing.
- **Workspace setup repeated in every package README**: "Clone the repo, run `pnpm install`..."
  belongs in the root README or CONTRIBUTING.md.
- **Relative links in a published package README** that break on npm (`../../docs/guide.md`).
  Use absolute GitHub URLs for anything outside the package directory, and absolute URLs for
  images.
- **A README for every internal config package** that says "Shared TypeScript config." and nothing
  else. Either skip it or say how to extend it.

## Don't over-correct

The aim is writing a maintainer would sign, not writing that dodges a detector.

- **Em dashes** **[checked by density]**: models use far more of them than professional
  writers do, and a model told to avoid them overuses commas and periods instead, which is its
  own tell. Use a period, colon, comma or parentheses for most, and keep an occasional dash where
  it's the right mark.
- **Fragments are fine in lists and tables**: feature bullets, option tables and parameter docs are
  terse by design. Don't inflate "`--json`: print results as JSON" into a sentence.
- **Reference material stays as lists and tables**: options, environment variables, commands,
  packages.
- **A flagged word can be the right word**: "Effect is a library for building robust ..." on a
  project whose whole pitch is typed error handling is defensible. Rewrite it anyway if the
  next clause doesn't prove it.
- **Don't strip the maintainer's voice**: jokes, first person ("See my blog post"), a pronunciation
  note, a haiku (htmx). Generated text has no voice; a human README often does. Keep it.
- **Don't strip real context**: sponsors and logos the maintainer chose stay, moved below the usage
  if they sat above it. Say what you moved in the report.

## A full rewrite

Before (generated, for a small retry helper):

````markdown
<p align="center"><img src="logo.png" width="120"></p>

# 🔁 retry-kit

![build](https://img.shields.io/badge/build-passing-brightgreen) ![PRs welcome](https://img.shields.io/badge/PRs-welcome-blue) ![TypeScript](https://img.shields.io/badge/made%20with-TypeScript-blue)

> A powerful, lightweight, and flexible retry library for modern JavaScript applications.

## ✨ Features

- **Robust**: Handles failures gracefully, ensuring your app stays resilient.
- **Flexible**: Highly configurable to fit any use case.
- **Lightweight**: Minimal footprint with zero dependencies.
- **TypeScript**: Built with TypeScript for a seamless developer experience.

## 🚀 Getting Started

### Prerequisites

- Node.js
- npm or yarn

### Installation

```bash
npm install retry-kit
```

## 📖 Usage

Whether you're calling an API or reading from a database, retry-kit has you covered!

```ts
import { retry } from 'retry-kit'
const result = await retry(() => fetchData())
```

## 🤝 Contributing

Contributions are welcome! Feel free to open a PR.

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

Made with ❤️ by the retry-kit team. Happy coding!
````

After (every fact checked against `package.json`, `src/index.ts` and a scratch run):

````markdown
# @lattice/retry-kit

[![npm](https://img.shields.io/npm/v/@lattice/retry-kit)](https://www.npmjs.com/package/@lattice/retry-kit)
[![CI](https://github.com/lattice/retry-kit/actions/workflows/test.yml/badge.svg)](https://github.com/lattice/retry-kit/actions/workflows/test.yml)

Retry an async function with exponential backoff. 1.1 kB gzipped, no dependencies, Node 18+ and
browsers.

```ts
import { retry } from '@lattice/retry-kit'

const user = await retry(() => fetch('/api/user').then((res) => res.json()), {
  attempts: 5,
  // Retry only server errors; a 404 fails immediately.
  shouldRetry: (error) => error.status >= 500,
})
```

Each retry waits twice as long as the last, starting at 100 ms and capped at `maxDelay`
(default 10 s), with jitter so many clients don't retry in step.

## Install

```sh
npm install @lattice/retry-kit
```

## API

### `retry(fn, options?)`

Calls `fn` until it resolves or `attempts` runs out, then rejects with the last error.

| Option | Default | |
| --- | --- | --- |
| `attempts` | `3` | Total calls, including the first. |
| `minDelay` | `100` | Milliseconds before the first retry. |
| `maxDelay` | `10_000` | Upper bound for any single wait. |
| `shouldRetry` | `() => true` | Return `false` to stop retrying for this error. |
| `signal` | | An `AbortSignal` that cancels the pending wait and rejects. |

## License

MIT
````

What changed and why: the package name now matches `package.json` (`@lattice/retry-kit`, not
`retry-kit`); the badge row is the npm version and the real `test.yml` workflow, with no license
badge until a LICENSE exists; the size comes from the build output, the Node version from `engines`; the
example uses the real options and was run; the backoff behaviour is read from `src/backoff.ts`;
the fake build badge, the "PRs welcome" badge, the emoji, the adjective list, the generic
prerequisites, the empty Contributing section and the sign-off are gone. The repo had no LICENSE
file, so the report asks the maintainer to add one rather than linking a file that doesn't exist.
