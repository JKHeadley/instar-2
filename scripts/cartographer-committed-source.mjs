import { execFileSync } from 'node:child_process';
import { isSecretBearingPath } from '../dist/recall/cartographer/summary.js';

// Host-side adaptation of 1.x CartographerTree.currentOids (217–234).
// The installed owner supplies admission for this exact canonical repository.
// No caller-supplied command, filesystem walk, working-tree blob, or model call.
export function readCommittedCartographerCapture({ root, admit, stopped, maxBytes = 2097152, maxNodes = 4096 }) {
  if (typeof root !== 'string' || !root.startsWith('/') || !Number.isSafeInteger(maxBytes)
    || maxBytes < 1 || maxBytes > 2097152 || !Number.isSafeInteger(maxNodes) || maxNodes < 1 || maxNodes > 4096)
    throw Error('bounded canonical source root required');
  const git = args => {
    if (stopped()) throw Error('committed source stopped');
    if (admit(root) !== true) throw Error('committed source admission refused');
    const out = execFileSync('git', ['--no-optional-locks', '-C', root, ...args], {
      encoding: 'utf8', timeout: 5000, maxBuffer: maxBytes, stdio: ['ignore', 'pipe', 'pipe'],
      env: { PATH: process.env.PATH, HOME: '/nonexistent', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_NO_REPLACE_OBJECTS: '1' },
    });
    if (stopped()) throw Error('committed source stopped');
    if (admit(root) !== true) throw Error('committed source admission refused'); return out;
  };
  if (git(['rev-parse', '--show-toplevel']).trim() !== root) throw Error('source root is not the exact repository');
  const revision = git(['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  if (!/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(revision)) throw Error('source revision unavailable');
  const rootOid = git(['rev-parse', `${revision}^{tree}`]).trim();
  const entries = git(['ls-tree', '-r', '-t', '-z', revision]).split('\0').filter(Boolean);
  if (entries.length + 1 > maxNodes) throw Error('committed source population exceeds budget');
  const rows = [{ path: '', kind: 'dir', oid: rootOid }];
  const excluded = [];
  for (const entry of entries) {
    const match = /^(\d{6}) (blob|tree|commit) ([a-f0-9]{40,64})\t([^\0]+)$/.exec(entry);
    if (!match) throw Error('malformed committed tree');
    const [, mode, type, oid, path] = match;
    // Symlinks and submodules are not traversed or described as local source.
    if (mode === '120000' || type === 'commit' || isSecretBearingPath(path) || excluded.some(p => path.startsWith(`${p}/`))) {
      if (type === 'tree') excluded.push(path);
      continue;
    }
    if (!['100644', '100755', '040000'].includes(mode) || /[\r\n\\]/.test(path)) throw Error('unsupported committed entry');
    rows.push({ path, kind: type === 'tree' ? 'dir' : 'file', oid });
  }
  const children = new Map(rows.filter(row => row.kind === 'dir').map(row => [row.path, []]));
  for (const row of rows) if (row.path !== '') {
    const parent = row.path.includes('/') ? row.path.slice(0, row.path.lastIndexOf('/')) : '';
    if (!children.has(parent)) throw Error('committed parent unavailable');
    children.get(parent).push(row.path);
  }
  let remaining = maxBytes;
  const captured = rows.map(row => {
    let content = null;
    if (row.kind === 'file') {
      const size = Number(git(['cat-file', '-s', row.oid]).trim());
      if (!Number.isSafeInteger(size) || size < 0 || size > Math.min(1048576, remaining)) throw Error('committed blob exceeds budget');
      content = git(['cat-file', 'blob', row.oid]);
      if (Buffer.byteLength(content) !== size) throw Error('committed blob is not lossless UTF-8');
      remaining -= size;
    }
    return { oid: row.oid, content, node: { path: row.path, kind: row.kind, children: children.get(row.path) ?? [],
      summary: '', summaryUpdatedAt: null, codeHash: null, codeRev: null, builtinKind: 'cartographer-node' } };
  });
  if (git(['rev-parse', '--verify', 'HEAD^{commit}']).trim() !== revision) throw Error('source revision changed during capture');
  const result = { root, revision, rows: captured };
  if (Buffer.byteLength(JSON.stringify(result)) > maxBytes) throw Error('committed capture exceeds budget');
  return result;
}
