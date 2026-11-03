// The error for a problem the person running the script has to fix: a bad option, a path that
// doesn't exist, no usable TypeScript. The entry point prints its message and exits with status 2.

/** An error whose message is printed as is, without a stack trace, before exiting with status 2. */
export class UsageError extends Error {
  name = 'UsageError';
}
