---
name: github-code-search
description: Use the ghx CLI to search GitHub for similar code examples, implementation patterns, APIs, configuration snippets, and real-world usage before or during coding work. Use when the user asks to find examples on GitHub, compare how other projects implement something, inspect open-source usage of a library or API, or research code patterns with ghx.
---

# GitHub Code Search

Use `ghx` to find similar code examples on GitHub when real-world code can clarify an implementation decision, API usage pattern, migration, framework convention, or configuration shape.

## Preflight

Before using `ghx`, check the required tools:

```bash
command -v gh
gh --version
gh auth status
command -v ghx
ghx --version
```

If `gh` is missing, explain that GitHub CLI is required and suggest installing it:

```bash
brew install gh
gh auth login
```

If `ghx` is missing, install it from npm:

```bash
npm install -g @johnlindquist/ghx
```

After install, run `ghx --help` because available short flags can vary by installed version.

## Search Workflow

1. Translate the user request into one or more concrete code-search queries.
2. Prefer targeted searches over broad searches. Add repo, language, extension, filename, or path filters when they materially improve signal.
3. Use `--pipe` when you need output in the terminal for analysis.
4. Start with a small result limit, then broaden only if results are weak.
5. Read the files behind the best hits, not just the matching lines, and check them before you cite them (next section). Search results show what people wrote, not what works.
6. Summarize patterns from multiple repositories. Do not copy code blindly.
7. When applying findings to the local codebase, adapt to local architecture, dependencies, and style.

## Check Before You Recommend

A pattern that shows up in ten repos can still be abandoned, outdated or broken. Before a repo, package or snippet goes into your answer:

- **Is it maintained?** For a package you recommend, check when it was last published and whether it's deprecated (`npm view <pkg> time.modified deprecated`, or the registry for other ecosystems). For a repo, check `gh repo view owner/repo --json isArchived,pushedAt`. Say so when something is unmaintained, archived or replaced by a newer API, and prefer the maintained alternative.
- **Does the code do what you say?** Read the relevant function, not just the matching line. Call out bugs and anti-patterns you spot (a rate limiter whose handler never rejects, a pub/sub setup that breaks with more than one process) instead of presenting every hit as good practice.
- **Is it current?** Code on GitHub is often written against older versions. When versions matter, check the project's current docs or release notes, and say which version a pattern applies to.
- **Can you confirm the claim cheaply?** When a claim about runtime behavior decides the recommendation and a tiny snippet can settle it, run it.

## Common Commands

Basic search:

```bash
ghx "query terms" --limit 10 --pipe
```

Search a specific repository:

```bash
ghx --repo owner/repo "query terms" --limit 10 --pipe
```

Search by language and extension:

```bash
ghx --language typescript --extension tsx "useState debounce" --limit 10 --pipe
```

Search specific filenames:

```bash
ghx --filename package.json "dependencies" --limit 20 --pipe
ghx --filename tsconfig.json "strict" --limit 20 --pipe
```

Search inside a path:

```bash
ghx --path src/components "Button props" --limit 10 --pipe
```

Include forks only when useful for examples that may live in forks:

```bash
ghx "query terms" --fork true --limit 10 --pipe
```

## Supported Languages

Use `--language <language>` with GitHub Linguist language names. Common values include:

- `typescript`
- `javascript`
- `python`
- `go`
- `rust`
- `java`
- `kotlin`
- `swift`
- `c`
- `cpp`
- `csharp`
- `php`
- `ruby`
- `elixir`
- `scala`
- `shell`
- `html`
- `css`
- `scss`
- `vue`
- `svelte`
- `sql`
- `yaml`
- `json`
- `markdown`

Prefer pairing language with extension when a language has multiple common file types:

```bash
ghx --language typescript --extension ts "createClient" --limit 10 --pipe
ghx --language typescript --extension tsx "use client" --limit 10 --pipe
ghx --language javascript --extension mjs "export default" --limit 10 --pipe
ghx --language python --extension py "FastAPI" --limit 10 --pipe
```

When unsure about the exact language spelling, omit `--language` and constrain by `--extension`, `--filename`, or `--repo` instead.

## Query Design

Use distinctive identifiers:

- exact function, class, prop, package, or error names
- framework APIs, hooks, decorators, or config keys
- file names such as `vite.config.ts`, `next.config.ts`, `tailwind.config.ts`, `.github/workflows/*.yml`
- two or three terms that must appear together

Avoid generic queries such as `button`, `auth`, or `database` unless paired with a framework, library, or API name.

## When Results Are Poor

- Search for a more specific API or error string.
- Restrict by `--language`, `--extension`, `--filename`, `--path`, or `--repo`.
- Try a well-known upstream repo first, then search broadly.
- Search for tests or examples when implementation code is too noisy.
- Increase `--limit` only after improving the query.

## Output Handling

When reporting findings:

- name the repositories or files that shaped the conclusion, and link to them with permalinks pinned to a commit (`https://github.com/owner/repo/blob/<sha>/path#L10-L24`) so the links don't drift
- group the results into patterns: for each, who uses it, when to choose it, and its caveats
- distinguish observed patterns from recommendations, and say what you checked (maintenance, versions, code read, anything you ran)
- end with a recommendation and the conditions under which you'd pick a different pattern
- explain how the pattern should be adapted locally
- keep excerpts short (about 10 lines at most) and link to the rest instead of pasting it

`ghx` saves markdown result files under the user config directory, for example on macOS:

```text
~/Library/Preferences/johnlindquist/ghx-nodejs/searches/
```

Use those saved files only as supporting evidence; the task outcome should remain grounded in the user's local codebase.
