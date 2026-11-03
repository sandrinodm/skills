// Package-manager checks. A workspace uses one package manager, set by its lockfile. Commands for
// another one (npm run in a pnpm repo) either fail or quietly install a second lockfile.

import { isShellBlock } from './markdown.mjs';

const PROMPT = /^\s*(\$|>|%)\s+/;
const PACKAGE_MANAGER_COMMAND = /^(npm|pnpm|yarn|bun)\s+(\S+)?/;
const NPM_FILTER_FLAG = /\s--filter[=\s]/;
const INSTALL_SUBCOMMAND = /^(install|i|add)$/;
const HAS_POSITIONAL_ARGUMENT = /\s[^-\s]/;
const GLOBAL_FLAG = /\s(-g|--global)\b/;
// One-off runners and scaffolders that don't touch the repo's lockfile.
const ONE_OFF_SUBCOMMANDS = new Set(['dlx', 'create', 'exec']);

/**
 * Reports npm-filter for `npm … --filter`, and wrong-package-manager for commands that use a
 * different package manager than the lockfile's. Installs of a published package (its users pick
 * their own manager), global installs and one-off runners are allowed. Without a lockfile only
 * npm-filter is checked.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkPackageManager(doc, project, add) {
  const isPublished =
    project.manifest?.name && !project.manifest.private && project.packageDir === project.dir;

  for (const block of doc.codeBlocks.filter(isShellBlock)) {
    for (const { line, text } of block.lines) {
      checkCommandLine(text.replace(PROMPT, '').trim(), line, { project, isPublished }, add);
    }
  }
}

function checkCommandLine(command, line, { project, isPublished }, add) {
  const match = command.match(PACKAGE_MANAGER_COMMAND);
  if (!match) {
    return;
  }

  const [, tool, subcommand = ''] = match;
  if (tool === 'npm' && NPM_FILTER_FLAG.test(command)) {
    add(
      line,
      'npm-filter',
      'npm has no --filter; ' +
        `use "npm run <script> -w <workspace>" or the repo's own package manager`,
    );
  }

  if (!project.lockManager || tool === project.lockManager) {
    return;
  }

  const afterSubcommand = command.slice(command.indexOf(subcommand) + subcommand.length);
  const isConsumerInstall =
    isPublished &&
    INSTALL_SUBCOMMAND.test(subcommand) &&
    HAS_POSITIONAL_ARGUMENT.test(afterSubcommand);
  const isGlobal = GLOBAL_FLAG.test(command) || ONE_OFF_SUBCOMMANDS.has(subcommand);
  if (!isConsumerInstall && !isGlobal) {
    add(
      line,
      'wrong-package-manager',
      `the repo uses ${project.lockManager} (${project.lockFile}) but this command uses ${tool}`,
    );
  }
}
