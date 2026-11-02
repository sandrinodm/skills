# Cleanup workflow

A readability pass changes many files at once, often on top of uncommitted work. The rules in
`SKILL.md` say what to change; this workflow makes sure *only* readability changes.

## 1. Baseline

Find the project's own commands in `package.json` (`typecheck`, `check`, `lint`, `test`, `build`,
or an aggregate like `ready`) and run each one. Record:

- which commands pass;
- the exact failing tests, if any;
- file and line counts, to size the work:
  `find src -name '*.ts' | xargs wc -l | sort -n | tail`.

Rerun any failing test on its own, two or three times. A test that fails in the full suite and
passes alone is flaky under load. Note it now so it's clearly not caused by your changes, and plan
to fix it later (step 7).

Check exit codes directly (`cmd; echo "exit=$?"`, or `set -o pipefail`). `cmd | tail` reports
`tail`'s exit status, not `cmd`'s.

## 2. Snapshot

Run `git status`. If there are uncommitted or untracked changes, they're the user's work in
progress, and your edits will be mixed into them. Before editing anything:

```bash
tar --exclude=node_modules --exclude=dist -czf "$SCRATCH/pre-refactor.tgz" .
git diff > "$SCRATCH/pre-refactor.diff"
git ls-files --others --exclude-standard > "$SCRATCH/pre-refactor-untracked.txt"
```

Don't `git stash`, reset, or commit to create a checkpoint unless the user asks. Those change the
user's repository state, and stash doesn't include untracked files by default.

## 3. Agree on scope

Unless the user has already said, ask two questions in one prompt:

1. **Line width**: 100 (recommended), 80, or keep the current setting. Explain that a wide width
   is usually why formatted code still feels dense, and that changing it touches most files.
2. **Depth**:
   - *Cosmetic only*: formatting, naming, comments, restructuring inside a function, no
     signature changes.
   - *Readability refactors* (recommended): named constants, shared helpers, split functions,
     options objects; behavior and public API unchanged.
   - *Deeper restructuring*: also split and move modules.

## 4. Mechanical pass

1. Change the formatter config (see `formatter.md`), then run the project's format command.
2. Re-run typecheck and lint. A formatter should never break them; if it does, stop and find out
   why.
3. Count what the formatter could not fix:
   `awk 'length > 100' $(git ls-files '*.ts')`. Those lines are usually comments and strings, which
   formatters don't wrap. They're part of the hand pass.
4. **Checkpoint** the tree, for example
   `rsync -a --exclude node_modules --exclude dist --exclude .git ./ "$SCRATCH/after-fmt/"`.
   This lets you, and the user, review the hand edits separately from the mechanical reflow, and
   it's the "before" tree for `string-diff.mjs`.

## 5. Hand pass

Read each file in full before editing it. Apply the rules in `SKILL.md`, using
`references/patterns.md` for judgment calls. Fix vertical spacing (rule 1) in every file you
edit; it's the most visible difference between agent-written and hand-written code, and the
formatter won't do it. Finish each file with the blank-line check from rule 1. Skip vendored and generated files entirely.

Don't rename files or move folders to match [the structure conventions](structure.md) in a
readability pass unless the user chose deeper restructuring. Report them as recommendations.

### Splitting a large codebase

Beyond a few thousand lines, split the work into areas with **disjoint file ownership** and run
them in parallel (for example one subagent per area). A split that worked for a ~13k-line service:

- the HTTP/protocol core (request decoding, responses, routing, limits, errors, media);
- the provider adapters (everything under `providers/`);
- operations and runtime (CLI, config, deployment, process handling, logging, telemetry, scripts).

Give each area the same brief:

- the files it owns, and the files it must not edit;
- "Don't change the signature of an export imported outside your files (check with grep); inside
  your files you may, if you update every caller";
- the rules to apply, with concrete examples from its own files;
- "Type or lint errors in files you don't own may be another area's work in progress. Your files
  must be clean.";
- verification: format its own files, run typecheck, lint and its own tests;
- report: substantive changes per file, what it left alone and why, verification results.

When one area's change breaks another area's typecheck (see "Inferred types that widen" in
`patterns.md`), send the cause to the owning area rather than fixing it across the boundary.

### Tests

Keep test edits light: rewrap comments, make minified fixture scripts readable, extract obvious
repeated fixtures, name timeouts. Don't rewrite assertions or rename tests. Tests are the proof
that behavior didn't change, so they should change as little as possible.

## 6. Verify behavior

Run all of these on the combined tree, checking real exit codes:

1. Typecheck, lint, format check, JSDoc or doc lint if the project has it.
2. Build.
3. Full test suite, at least twice. If anything was flaky, run it five times.
4. **User-facing strings**:
   `node <skill>/scripts/string-diff.mjs "$SCRATCH/after-fmt" .`
   The script joins literals concatenated with `+` and keeps `${…}` expressions, so expect to see:
   - templates where a literal number became a constant (`200` became `${MAX_MESSAGE_PARTS}`):
     find the constant and confirm its value;
   - strings that moved into a catalog or factory: confirm the catalog holds the same text.

   Anything else is a behavior change. Revert it, or report it as intentional. If the user said
   output may change (for example the project isn't released yet), keep the changes and list
   them in the report instead of reverting them. Long conditions split into named checks
   (rule 6) change error text on purpose; list those too.
5. **Consolidated errors**: for every `new Error(status, code, message)` replaced by a shared
   helper, check that the helper produces the same status and message. A short script that loads
   the catalog and scans the checkpoint tree's constructors does this in seconds. Code that reuses
   an error code with a *different* message must still construct its own error.
6. **Generated output**: where a refactor rebuilt a prompt, CLI argument list, template or file
   body from parts, render the old and new versions for a few representative inputs and compare
   them byte for byte.
7. **Flaky tests**: if a test is still intermittent, investigate it. Read the assertion, find what
   differs under load (usually a tight timeout or an ordering assumption), and fix the cause in
   the test. See "Test timing" in `patterns.md`.

Some checks can't run in your environment (for example Docker-only contract tests, or verifiers
that need real provider logins). Typecheck them, and say clearly that they weren't run.

## 7. Report

Lead with the outcome and the verification results, stated against the baseline (for example
"7/7 tests passed before the change and pass after it"), then:

- the formatter change, and how many files it reflowed;
- substantive hand changes, grouped by area, with any new shared helpers or modules named;
- signature changes, and confirmation that every caller was updated;
- what was deliberately left alone, and why;
- every observable behavior difference, however small, or that you checked and found none;
- what couldn't be run;
- where the snapshot and checkpoint are, and how to review the hand edits on their own
  (`diff -ru "$SCRATCH/after-fmt" .`).

Offer to commit, as a mechanical-format commit followed by a readability commit on a branch, rather
than committing unasked.
