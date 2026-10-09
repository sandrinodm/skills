#!/usr/bin/env node
// Builds the GitHub Pages landing page into _site/ from the README skills table,
// each skill's SKILL.md frontmatter, and its optional agents/openai.yaml.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, '_site');
const tilts = ['-0.7deg', '0.5deg', '-0.3deg', '0.8deg', '-0.5deg'];

const escapeHtml = (text) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fail = (message) => {
  console.error(`build-site: ${message}`);
  process.exit(1);
};

function frontmatterField(markdown, key) {
  const lines = (markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? '').split(/\r?\n/);
  const index = lines.findIndex((line) => line.startsWith(`${key}:`));
  if (index === -1) return '';
  let value = lines[index].slice(key.length + 1).trim();
  // Folded (>) and literal (|) block scalars continue on the indented lines below.
  if (value === '' || /^[>|][-+]?$/.test(value)) {
    const block = [];
    for (const line of lines.slice(index + 1)) {
      if (!/^\s+\S/.test(line)) break;
      block.push(line.trim());
    }
    value = block.join(' ');
  }
  return value.replace(/^(["'])(.*)\1$/, '$2');
}

const readme = readFileSync(join(root, 'README.md'), 'utf8');

const commandTemplate = readme.match(/^(.*\bskills add \S+ --skill )<skill-name>$/m)?.[1];
if (!commandTemplate) fail('README.md is missing the "skills add <repo> --skill <skill-name>" install command.');
const repo = commandTemplate.match(/skills add (\S+)/)[1];

const skills = [...readme.matchAll(/^\|\s*\[([^\]]+)\]\(\.\/skills\/([\w-]+)\/?\)\s*\|\s*(.*?)\s*\|\s*`([^`]+)`\s*\|/gm)].map(
  ([, name, slug, summary, install]) => {
    const skillDir = join(root, 'skills', slug);
    const skillMd = join(skillDir, 'SKILL.md');
    const agentYaml = join(skillDir, 'agents', 'openai.yaml');
    return {
      name,
      slug,
      summary,
      install,
      trigger: existsSync(skillMd) ? frontmatterField(readFileSync(skillMd, 'utf8'), 'description') : '',
      color: existsSync(agentYaml)
        ? readFileSync(agentYaml, 'utf8').match(/brand_color:\s*["']?(#[0-9a-f]{3,8})\b/i)?.[1]
        : undefined,
    };
  },
);

const folders = readdirSync(join(root, 'skills'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);
const listed = new Set(skills.map((skill) => skill.slug));
const unlisted = folders.filter((folder) => !listed.has(folder));
const missing = [...listed].filter((slug) => !folders.includes(slug));
if (unlisted.length || missing.length) {
  fail(
    [
      'the README.md skills table is out of sync with skills/.',
      ...unlisted.map((slug) => `  skills/${slug} has no row in the README table`),
      ...missing.map((slug) => `  the README table lists ${slug}, but skills/${slug} does not exist`),
    ].join('\n'),
  );
}

const card = (skill, index) => {
  const style = [skill.color && `--tape: ${skill.color}`, `--tilt: ${tilts[index % tilts.length]}`].filter(Boolean).join('; ');
  const trigger = skill.trigger
    ? `\n          <p class="skill-trigger"><span class="key">description:</span> ${escapeHtml(skill.trigger)}</p>`
    : '';
  return `
        <li class="skill" id="${skill.slug}" style="${style}">
          <h3 class="tape">${escapeHtml(skill.name)}</h3>
          <p class="skill-summary">${escapeHtml(skill.summary)}</p>${trigger}
          <div class="skill-actions">
            <div class="install">
              <code>${escapeHtml(skill.install)}</code>
              <button class="copy" type="button"><span class="copy-label">Copy</span><span class="sr-only"> install command for ${escapeHtml(skill.name)}</span></button>
            </div>
            <a class="source" href="https://github.com/${escapeHtml(repo)}/blob/main/skills/${skill.slug}/SKILL.md">Read SKILL.md</a>
          </div>
        </li>`;
};

const values = {
  repo: escapeHtml(repo),
  // One span per word so the hero command only wraps between words, never inside --skill.
  command_prefix: commandTemplate.trim().split(/\s+/).map((word) => `<span class="token">${escapeHtml(word)}</span>`).join(' '),
  first_slug: skills[0]?.slug ?? '',
  count: `${skills.length} ${skills.length === 1 ? 'skill' : 'skills'}`,
  skills: skills.map(card).join(''),
  slot_json: JSON.stringify(skills.map(({ slug, color }) => ({ slug, color }))).replace(/</g, '\\u003c'),
};

const html = readFileSync(join(root, 'site', 'index.html'), 'utf8').replace(/\{\{(\w+)\}\}/g, (placeholder, key) => {
  if (!(key in values)) fail(`site/index.html uses unknown placeholder ${placeholder}`);
  return values[key];
});

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'index.html'), html);
console.log(`build-site: wrote _site/index.html with ${values.count}`);
