// Loose name comparison for package and license names that differ only in case and punctuation,
// and decoding the names written inside URLs.

const NOT_LETTER_OR_DIGIT = /[^a-z0-9]/g;

/**
 * Lowercases a name and drops everything but ASCII letters and digits, so "@acme/Web-UI",
 * "acme web ui" and "acmewebui" compare equal.
 *
 * @param {string} name
 * @returns {string} Empty for a name with no letters or digits.
 */
export function squash(name) {
  return name.toLowerCase().replace(NOT_LETTER_OR_DIGIT, '');
}

/**
 * Decodes the `%`-escapes in part of a URL, such as a link target or a badge path. A README can
 * contain a malformed escape (`50%off.md`); that part is returned as written instead of throwing.
 *
 * @param {string} text
 * @returns {string}
 */
export function decodeUrlPart(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
