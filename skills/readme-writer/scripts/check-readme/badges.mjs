// Badge checks. The style checks look only at the README: too many badges, static badges that
// imitate live status, vanity badges. The fact checks compare badges with the repo: npm badges
// for the package in the manifest, CI badges for a workflow that exists, a license badge that
// matches the manifest.

import fs from 'node:fs';
import path from 'node:path';

import { decodeUrlPart, squash } from './names.mjs';
import { readTextFile } from './project.mjs';

const MAX_BADGES = 6;
const MAX_URL_PREVIEW_CHARS = 80;

// A Markdown image, optionally wrapped in a link (groups 1 and 2), or an HTML image (group 3).
const IMAGE_WITH_OPTIONAL_LINK =
  /(?:\[)?!\[[^\]]*\]\(([^)\s]+)[^)]*\)(?:\]\(([^)\s]+)[^)]*\))?|<img[^>]+src="([^"]+)"/g;

// Image URLs that come from a badge service or look like a badge.
const BADGE_URL = new RegExp(
  [
    String.raw`shields\.io`,
    String.raw`badgen\.net`,
    String.raw`badge\.fury`,
    String.raw`\/badge\.svg`,
    String.raw`\/badges?\/`,
    String.raw`codecov\.io`,
    'coveralls',
    String.raw`deepwiki\.com\/badge`,
    'star-history',
    String.raw`api\.star-history`,
    String.raw`bundlejs\.com\/badge`,
    'packagephobia',
    String.raw`jsr\.io\/badges`,
  ].join('|'),
  'i',
);

const STATIC_STATUS_BADGE =
  /shields\.io\/badge\/(build|tests?|ci|coverage|maintained|maintenance|docs|PRs|prs|quality)[-_]/i;
const LANGUAGE_BADGE =
  /shields\.io\/badge\/[^?]*(typescript|javascript|made[%_ -]?(20)?with|built[%_ -]?(20)?with)/i;
const STAR_BADGE = /star-history|stars\?|\/stars\//i;
const NPM_VERSION_BADGE = /shields\.io\/npm\/v\/|badgen\.net\/npm\/v\/|badge\.fury\.io\/js\//;
const CI_BADGE = /github\.com\/([^/]+)\/([^/]+)\/(?:actions\/)?workflows\/([^/?]+)\/badge\.svg/;
const STATIC_LICENSE_BADGE = /shields\.io\/badge\/licen[cs]e[-:]([^-/?]+)/i;
const UNDERSCORES = /_/g;
const SVG_EXTENSION = /\.svg$/;
const YAML_FILE = /\.ya?ml$/;
const WORKFLOW_NAME = /^name:\s*['"]?(.+?)['"]?\s*$/m;
const GITHUB_REPOSITORY = /github(?:\.com[:/]|:)([^/]+)\/([^/#]+?)(?:\.git)?(?:#|$)/;

// Where the common badge services put an npm package name. The first group is the name.
const NPM_PACKAGE_IN_URL = [
  new RegExp(
    String.raw`shields\.io\/npm\/(?:v|dm|dw|dy|dt|l|types|unpacked-size|collaborators|node\/v)\/` +
      String.raw`((?:@[^/]+\/)?[^/?.]+(?:\.[^/?.]+)*?)(?:\.svg|\?|\/|$)`,
  ),
  /badgen\.net\/npm\/(?:v|dm|dw|dy|dt|license|types|node)\/((?:@[^/]+\/)?[^/?]+)/,
  /badge\.fury\.io\/js\/((?:@[^/]+%2F|@[^/]+\/)?[^/?]+?)(?:\.svg|\?|$)/,
  /bundlephobia\.com\/(?:badge\/)?(?:minzip|min|package)\/((?:@[^/]+\/)?[^/?@]+)/,
  /packagephobia\.com\/(?:badge|result)\?p=((?:@[^/&]+\/)?[^&@]+)/,
  /bundlejs\.com\/(?:badge)?\?q=((?:@[^/&]+\/)?[^&@,]+)/,
  /shields\.io\/bundlejs\/size\/((?:@[^/]+\/)?[^/?]+)/,
  /npmjs\.com\/package\/((?:@[^/]+\/)?[^/?#]+)/,
];

/**
 * @typedef {{ line: number, url: string, link: string | null }} Badge
 */

/**
 * Finds the badge images in the README's prose, with the URL they link to when they're wrapped
 * in a Markdown link.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @returns {Badge[]} In reading order.
 */
export function collectBadges(doc) {
  const badges = [];

  for (const { line, text } of doc.prose) {
    for (const match of text.matchAll(IMAGE_WITH_OPTIONAL_LINK)) {
      const url = match[1] ?? match[3];
      if (BADGE_URL.test(url)) {
        badges.push({ line, url, link: match[2] ?? null });
      }
    }
  }

  return badges;
}

/**
 * Reports badge-wall, static-status-badge and vanity-badge.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkBadges(doc, add) {
  const badges = collectBadges(doc);
  if (badges.length > MAX_BADGES) {
    add(
      badges[0].line,
      'badge-wall',
      `${badges.length} badges; keep the few a reader acts on (version, CI, license) ` +
        'and drop the rest',
    );
  }

  for (const { line, url } of badges) {
    checkBadgeStyle(line, url, add);
  }
}

/**
 * Reports badge-wrong-package and no-npm-badge for a published package, then missing-workflow,
 * badge-wrong-repo and license-mismatch for any README.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkBadgeFacts(doc, project, add) {
  const badges = collectBadges(doc);
  // Only a README next to its package.json describes that package.
  const manifest = project.packageDir === project.dir ? project.manifest : null;
  const isPublished = Boolean(manifest?.name && !manifest.private);
  if (isPublished) {
    checkNpmBadges(badges, manifest, add);
  }

  checkCiBadges(badges, project, add);
  checkLicenseBadges(badges, project, add);
}

function checkBadgeStyle(line, url, add) {
  if (STATIC_STATUS_BADGE.test(url)) {
    add(
      line,
      'static-status-badge',
      `static badge that imitates live status (${url.slice(0, MAX_URL_PREVIEW_CHARS)}); ` +
        'link a real CI or coverage badge or drop it',
    );
  }

  if (LANGUAGE_BADGE.test(url)) {
    add(
      line,
      'vanity-badge',
      'language or "made with" badge; ' +
        'say "Type definitions are included" in the text if that matters',
    );
  }

  if (STAR_BADGE.test(url)) {
    add(
      line,
      'vanity-badge',
      'star count or star-history chart; ' +
        'it tells a reader nothing about whether the project fits',
    );
  }
}

function checkNpmBadges(badges, manifest, add) {
  for (const { line, url, link } of badges) {
    for (const target of [url, link].filter(Boolean)) {
      const named = npmPackageInUrl(target);
      if (named && named !== manifest.name) {
        add(
          line,
          'badge-wrong-package',
          `badge is for "${named}" but this package is ${manifest.name}`,
        );
      }
    }
  }

  const hasVersionBadge = badges.some(({ url }) => NPM_VERSION_BADGE.test(url));
  if (!hasVersionBadge) {
    add(
      1,
      'no-npm-badge',
      'published package without an npm version badge: ' +
        `[![npm](https://img.shields.io/npm/v/${manifest.name})]` +
        `(https://www.npmjs.com/package/${manifest.name})`,
    );
  }
}

// A CI badge names its workflow by file name or by the workflow's `name:`.
function checkCiBadges(badges, project, add) {
  const workflowsDir = path.join(project.repoRoot, '.github', 'workflows');
  const workflows = listWorkflowFiles(workflowsDir);
  const repoSlug = githubSlugFromManifest(project.manifest ?? project.rootManifest);

  for (const { line, url } of badges) {
    const ci = url.match(CI_BADGE);
    if (!ci) {
      continue;
    }

    const [, owner, repo, workflow] = ci;
    const decoded = decodeUrlPart(workflow);
    const exists = workflows.some(
      (file) => file === decoded || readWorkflowName(path.join(workflowsDir, file)) === decoded,
    );
    if (!exists) {
      const have = workflows.length ? workflows.join(', ') : 'none';
      add(
        line,
        'missing-workflow',
        `CI badge for workflow "${decoded}" but .github/workflows has ${have}`,
      );
    }

    if (repoSlug && `${owner}/${repo}`.toLowerCase() !== repoSlug.toLowerCase()) {
      add(
        line,
        'badge-wrong-repo',
        `CI badge points at ${owner}/${repo} but package.json says the repository is ${repoSlug}`,
      );
    }
  }
}

function checkLicenseBadges(badges, project, add) {
  const declared = typeof project.manifest?.license === 'string' ? project.manifest.license : null;
  if (!declared) {
    return;
  }

  for (const { line, url } of badges) {
    const staticLicense = url.match(STATIC_LICENSE_BADGE);
    if (!staticLicense) {
      continue;
    }

    const named = decodeUrlPart(staticLicense[1]).replace(UNDERSCORES, ' ');
    if (squash(named) !== squash(declared)) {
      add(
        line,
        'license-mismatch',
        `license badge says ${named} but package.json says ${declared}`,
      );
    }
  }
}

// The npm package a badge or link refers to, for the common badge services.
function npmPackageInUrl(url) {
  for (const pattern of NPM_PACKAGE_IN_URL) {
    const match = url.match(pattern);
    if (match) {
      return decodeUrlPart(match[1]).replace(SVG_EXTENSION, '');
    }
  }

  return null;
}

// "owner/repo" from package.json's repository field, when it points at GitHub.
function githubSlugFromManifest(manifest) {
  const repository = manifest?.repository;
  const url = typeof repository === 'string' ? repository : repository?.url;
  if (!url) {
    return null;
  }

  const match = url.match(GITHUB_REPOSITORY);
  return match ? `${match[1]}/${match[2]}` : null;
}

function readWorkflowName(file) {
  return (readTextFile(file) ?? '').match(WORKFLOW_NAME)?.[1] ?? null;
}

function listWorkflowFiles(dir) {
  try {
    return fs.readdirSync(dir).filter((name) => YAML_FILE.test(name));
  } catch {
    return [];
  }
}
