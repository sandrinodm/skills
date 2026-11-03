// Command checks: every command in a shell block must name something that exists in the repo.
// Package-manager scripts and turbo tasks are checked in package-scripts.mjs; this file splits
// the commands out of the blocks and checks make targets, just recipes, `cd` directories and
// script paths.

import fs from 'node:fs';
import path from 'node:path';

import { isShellBlock } from './markdown.mjs';
import { checkPackageManagerCommand, checkTurboCommand } from './package-scripts.mjs';

// Commands that run a package's binary, longest first so `pnpm exec` wins over `pnpm`.
const TURBO_RUNNERS = [
  ['pnpm', 'exec'],
  ['pnpm', 'dlx'],
  ['yarn', 'dlx'],
  ['bun', 'x'],
  ['npx'],
  ['pnpm'],
  ['yarn'],
  ['bunx'],
];
const PACKAGE_MANAGERS = new Set(['npm', 'pnpm', 'yarn', 'bun']);
// Interpreters whose first argument is the script they run. bun is a package manager first, so
// `bun ./x.ts` goes to the package-manager check instead.
const SCRIPT_RUNNERS = new Set(['node', 'bash', 'sh', 'python', 'python3', 'tsx', 'deno']);

const PROMPT = /^\s*(\$|>|%|PS>)\s+/;
const TRAILING_COMMENT = /\s+#.*$/;
const COMMAND_SEPARATOR = /\s*(?:&&|\|\||;)\s*/;
const WHITESPACE = /\s+/;
// A cd after a clone, mkdir or scaffolder command targets a directory that doesn't exist yet.
const CREATES_DIRECTORIES = /\b(git clone|mkdir|create|init|new|degit|giget)\b/;
// `cd ~/x`, `cd $DIR` and `cd -` point outside the repo.
const OUTSIDE_REPO_DIR = /^[~$-]/;
const PLACEHOLDER_START = '<';
const SCRIPT_PATH = /^(\.\.?\/|[\w.-]+\/)[\w./-]+\.(m?js|cjs|ts|mts|sh|py)$/;

/**
 * @typedef {import('./project.mjs').Project & { createsDirs: boolean }} CommandContext
 */

/**
 * Reports missing-target, missing-dir and missing-file, and through package-scripts.mjs
 * missing-script, missing-task and missing-workspace. Reads the commands in shell blocks, one per
 * line, after dropping prompts (`$`, `>`, `%`, `PS>`) and trailing comments, and splits each line
 * at `&&`, `||` and `;`.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkCommands(doc, project, add) {
  for (const block of doc.codeBlocks.filter(isShellBlock)) {
    const createsDirs = block.lines.some(({ text }) => CREATES_DIRECTORIES.test(text));
    const context = { ...project, createsDirs };

    for (const { line, text } of block.lines) {
      const command = text.replace(PROMPT, '').replace(TRAILING_COMMENT, '').trim();
      if (command === '' || command.startsWith('#')) {
        continue;
      }

      for (const part of command.split(COMMAND_SEPARATOR)) {
        checkCommand(part.trim(), line, context, add);
      }
    }
  }
}

// Turbo run through a package manager (`pnpm turbo build`, `npx turbo dev`, `pnpm exec turbo`)
// is checked as turbo, before the package-manager check sees it.
function checkCommand(command, line, context, add) {
  const words = command.split(WHITESPACE);
  const [tool] = words;
  const turboAt = turboIndex(words);
  if (turboAt !== -1) {
    checkTurboCommand(words.slice(turboAt + 1), line, context, add);
  } else if (PACKAGE_MANAGERS.has(tool)) {
    checkPackageManagerCommand(tool, words.slice(1), line, context, add);
  } else if (tool === 'make') {
    checkMakeTargets(words, line, context, add);
  } else if (tool === 'just') {
    checkJustRecipe(words, line, context, add);
  } else if (tool === 'cd') {
    checkCd(words[1], line, context, add);
  } else {
    checkScriptPath(SCRIPT_RUNNERS.has(tool) ? words[1] : tool, line, context, add);
  }
}

function checkMakeTargets(words, line, context, add) {
  if (!context.makeTargets) {
    return;
  }

  const targets = words.slice(1).filter((word) => !word.startsWith('-') && !word.includes('='));
  for (const target of targets) {
    if (!context.makeTargets.has(target)) {
      add(line, 'missing-target', `make target "${target}" isn't in the Makefile`);
    }
  }
}

function checkJustRecipe(words, line, context, add) {
  if (!context.justRecipes) {
    return;
  }

  const recipe = words.slice(1).find((word) => !word.startsWith('-'));
  if (recipe && !context.justRecipes.has(recipe)) {
    add(line, 'missing-target', `just recipe "${recipe}" isn't in the justfile`);
  }
}

function checkCd(dir, line, context, add) {
  if (!dir || context.createsDirs) {
    return;
  }

  if (OUTSIDE_REPO_DIR.test(dir) || dir.includes(PLACEHOLDER_START)) {
    return;
  }

  if (!existsInRepo(context, dir)) {
    add(line, 'missing-dir', `"cd ${dir}": no such directory in this repo`);
  }
}

function checkScriptPath(script, line, context, add) {
  if (script && SCRIPT_PATH.test(script) && !existsInRepo(context, script)) {
    add(line, 'missing-file', `"${script}" doesn't exist`);
  }
}

// Commands may be run from the README's folder, the workspace root or the repo root.
function existsInRepo(project, relativePath) {
  const bases = [project.dir, project.workspaceRoot, project.repoRoot].filter(Boolean);
  return bases.some((base) => fs.existsSync(path.resolve(base, relativePath)));
}

// Where `turbo` sits in a command that runs it: first, or after a runner such as `npx`, `pnpm`,
// `pnpm exec`, `yarn dlx` or `bunx`. -1 when the command doesn't run turbo.
function turboIndex(words) {
  if (words[0] === 'turbo') {
    return 0;
  }

  const startsWith = (prefix) => prefix.every((word, index) => words[index] === word);
  const runner = TURBO_RUNNERS.find(startsWith);
  return runner && words[runner.length] === 'turbo' ? runner.length : -1;
}
