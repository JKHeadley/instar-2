// Read-only Part Ten worktree census. The caller supplies bounded process execution and
// the existing owner's activity/ownership observations. Missing observations stay unknown.
export function parseWorktreeList(text) {
  if (typeof text !== 'string' || !text.endsWith('\0\0')) return null;
  const rows = [];
  for (const record of text.slice(0, -2).split('\0\0')) {
    const fields = record.split('\0');
    const path = fields.find(field => field.startsWith('worktree '))?.slice(9);
    const head = fields.find(field => field.startsWith('HEAD '))?.slice(5);
    if (!path?.startsWith('/') || !/^[a-f0-9]{40,64}$/u.test(head ?? '')
      || fields.includes('bare') || fields.some(field => field.startsWith('prunable'))) return null;
    rows.push({ path, head });
  }
  return new Set(rows.map(row => row.path)).size === rows.length ? rows : null;
}

export function createWorktreeInventory(ports) {
  return Object.freeze({ async census(repository) {
    const base = { machine: ports.machine, freshForMs: ports.freshForMs, sourceTime: ports.now() };
    const failed = () => ({ ...base, sourceTime: ports.now(), status: 'failed', worktrees: [] });
    try {
      const text = await ports.query('git', ['--no-optional-locks', '-C', repository, 'worktree', 'list', '--porcelain', '-z']);
      const rows = parseWorktreeList(text);
      if (!rows || !Number.isSafeInteger(ports.limit) || ports.limit < 1) return failed();
      const worktrees = [];
      let complete = rows.length <= ports.limit;
      for (const row of rows.slice(0, ports.limit)) {
        const status = await ports.query('git', ['--no-optional-locks', '-C', row.path, 'status', '--porcelain=v1', '-z', '--untracked-files=all']);
        if (status === null) { complete = false; continue; }
        const observation = await ports.observe(row.path);
        worktrees.push({ ...row, dirty: status.length > 0, owner: observation?.owner ?? 'unknown',
          activity: observation?.activity ?? null });
      }
      // Re-enumeration refuses a path/head change during the per-checkout reads.
      const after = await ports.query('git', ['--no-optional-locks', '-C', repository, 'worktree', 'list', '--porcelain', '-z']);
      if (after !== text) complete = false;
      return { ...base, status: complete ? 'complete' : 'partial', worktrees };
    } catch { return failed(); }
  } });
}
