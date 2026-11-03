// Port checks. Scaffolder READMEs keep saying 3000 after the dev script moves to 3001, so every
// localhost port in the README is compared with the port the package's dev script pins.

import path from 'node:path';

import { ENV_EXAMPLE_FILES, readTextFile } from './project.mjs';

const PINNED_PORT = /(?:--port[=\s]|-p\s|PORT=)(\d{2,5})/;
const LOCAL_URL_PORT = /(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/g;
const ENV_PORT = /^\s*[A-Z_]*PORT\s*=\s*(\d{2,5})|localhost:(\d{2,5})/gm;
// "8080:80", "127.0.0.1:8080:80": the first group is the host port.
const COMPOSE_HOST_PORT = /["']?(?:[\d.]+:)?(\d{2,5}):\d{2,5}["']?/g;
const COMPOSE_FILES = ['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'];

/**
 * Reports wrong-port for each `localhost:<port>` (or 127.0.0.1, 0.0.0.0) in prose and code that
 * differs from the port pinned by the package's `dev` script (or `start` when there's no `dev`).
 * Ports that belong to something else in the workspace are allowed. Does nothing when the README
 * isn't next to its package.json or the script pins no port.
 *
 * @param {import('./markdown.mjs').Doc} doc
 * @param {import('./project.mjs').Project} project
 * @param {import('./findings.mjs').AddFinding} add
 * @returns {void}
 */
export function checkPorts(doc, project, add) {
  const scripts = project.packageDir === project.dir ? project.manifest?.scripts : null;
  const devScript = scripts?.dev ?? scripts?.start ?? '';
  const pinned = pinnedPort(devScript);
  if (!pinned) {
    return;
  }

  const otherPorts = knownPorts(project);
  const lines = [...doc.prose, ...doc.codeBlocks.flatMap((block) => block.lines)];
  for (const { line, text } of lines) {
    for (const [, port] of text.matchAll(LOCAL_URL_PORT)) {
      if (port !== pinned && !otherPorts.has(port)) {
        add(
          line,
          'wrong-port',
          `README says port ${port} but the dev script runs on ${pinned} ("${devScript}")`,
        );
      }
    }
  }
}

// The port a script sets with --port, -p or PORT=.
function pinnedPort(script) {
  return script.match(PINNED_PORT)?.[1];
}

// Ports that belong to something else in the workspace: other packages' scripts, PORT= values
// and localhost URLs in .env examples, and docker compose host ports. A README may mention those.
function knownPorts(project) {
  const ports = new Set();

  for (const { dir, manifest } of project.workspaces) {
    if (dir === project.dir) {
      continue;
    }

    for (const script of Object.values(manifest.scripts ?? {})) {
      const port = pinnedPort(String(script));
      if (port) {
        ports.add(port);
      }
    }
  }

  const dirs = [
    project.workspaceRoot ?? project.repoRoot,
    ...project.workspaces.map(({ dir }) => dir),
  ].filter(Boolean);
  for (const dir of dirs) {
    addFilePorts(dir, ENV_EXAMPLE_FILES, ENV_PORT, ports);
    addFilePorts(dir, COMPOSE_FILES, COMPOSE_HOST_PORT, ports);
  }

  return ports;
}

// Adds the first matched group of every match in each of the files that exists.
function addFilePorts(dir, names, pattern, ports) {
  for (const name of names) {
    const text = readTextFile(path.join(dir, name)) ?? '';
    for (const match of text.matchAll(pattern)) {
      ports.add(match[1] ?? match[2]);
    }
  }
}
