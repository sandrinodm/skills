import { readFile } from 'node:fs/promises';
import path from 'node:path';

export class BundleError extends Error {}

export interface App {
  readonly root: string;
  readonly composeFiles: readonly string[];
  readonly assets?: readonly string[];
}

export interface Bundle {
  readonly files: ReadonlyMap<string, string>;
  readonly totalBytes: number;
}

export type SecretValues = Readonly<Record<string, string | undefined>>;

const MAX_BUNDLE_FILES = 128;
const MAX_BUNDLE_BYTES = 1024 * 1024;

/**
 * Reads every Compose file and asset of an app into memory, relative to the app root.
 */
export async function readBundle(app: App): Promise<Bundle> {
  if (app.composeFiles.length === 0) {
    throw new BundleError('An app needs at least one Compose file');
  }
  if (!path.isAbsolute(app.root)) {
    throw new BundleError('The app root must be an absolute path');
  }
  const paths = [...new Set([...app.composeFiles, ...(app.assets ?? [])])];
  if (paths.length > MAX_BUNDLE_FILES) {
    throw new BundleError(`Compose bundles allow at most ${MAX_BUNDLE_FILES} files`);
  }
  const files = new Map<string, string>();
  let totalBytes = 0;
  for (const relative of paths) {
    // Bundles only read inside the app root, so a path like ../secrets can't leak.
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new BundleError(`Bundle paths must stay inside the app root: ${relative}`);
    }
    const contents = await readFile(path.join(app.root, relative), 'utf8');
    totalBytes += Buffer.byteLength(contents);
    if (totalBytes > MAX_BUNDLE_BYTES) {
      throw new BundleError('Compose bundles allow at most 1 MiB');
    }
    files.set(relative, contents);
  }
  const bundle = { files, totalBytes };
  return bundle;
}

/**
 * Reads a secret from the environment-style values, rejecting values that would break an env file.
 */
export function resolveSecret(values: SecretValues, source: string): string {
  const value = values[source];
  if (!value || /[\r\n\0]/.test(value)) {
    throw new BundleError(`Secret ${source} must be a single-line value`);
  }
  const trimmed = value.trim();
  return trimmed;
}

/**
 * Counts the newline-terminated lines in a file.
 */
export function countLines(contents: string): number {
  let lines = 0;
  for (const character of contents) {
    if (character === '\n') {
      lines += 1;
    }
  }
  return lines;
}
