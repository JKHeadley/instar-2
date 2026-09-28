// Rules 26, 49, 69, 115 (D17 §2): the exact bytes a supported harness tuple was certified on. A
// tuple declares its composition's files (in order) and runtime; this digest covers the runtime
// line and each file's path and bytes, so changing the driver, the owners it composes, the fixed
// runner or the runtime changes it. The architecture lint recomputes it against the declared
// value, and the harness's contract test asserts the running composition reports the same digest.
import { createHash } from 'node:crypto';

/** `read(path)` returns a repository file's text, or null when it is absent. */
export function compositionDigest(runtime, files, read) {
  const parts = [`runtime:${runtime}`];
  for (const path of files) {
    const text = read(path);
    if (typeof text !== 'string') return null;
    parts.push(`${path}\0${text}`);
  }
  return `sha256:${createHash('sha256').update(parts.join('\0\0'), 'utf8').digest('hex')}`;
}

/** The running runtime, in the form a tuple declares it. */
export const currentRuntime = () => `node-${process.versions.node.split('.')[0]}`;
