import { expect, it } from 'vitest';
// @ts-expect-error physical host outside pure core
import { enforceSessionDeadline } from '../../scripts/session-deadline-watchdog.mjs';

function fixture() {
  const name = `instar20-${'a'.repeat(24)}`, identity = `${name}:123:456`;
  let session = { name, identity, turnDeadline: 2000, turnStartedAt: 1000, closedAt: null as number | null,
    turnReceiptIds: ['old'] };
  let stamp = '123:456', failSave = false, killCode = 0;
  let journal: { sessions: object[] } = { sessions: [session] };
  const events: object[] = [], actions: string[] = [];
  const io = { exclusive: (run: () => unknown) => run(), load: () => journal,
    save: (next: typeof journal) => { if (failSave) throw Error('disk unavailable'); journal = next; actions.push('durable-halt'); },
    readInbox: () => events, tmux: (args: string[]) => {
      if (args[0] === 'kill-session') { actions.push('kill'); expect(journal.sessions[0]).toHaveProperty('deadlineHalt'); }
      return { code: args[0] === 'kill-session' ? killCode : 0, stdout: stamp };
    } };
  return { name, identity, io, events, actions, state: () => journal.sessions[0],
    session, stamp: (s: string) => { stamp = s; }, failSave: () => { failSave = true; }, failKill: () => { killCode = 1; } };
}
it('the independent watchdog persists the exact halt before stopping its worker', () => {
  const f = fixture(); expect(enforceSessionDeadline(f.io, f.name, f.identity, 2000, 2000)).toBe(true);
  expect(f.actions).toEqual(['durable-halt', 'kill']);
  expect(f.state()).toMatchObject({ deadlineHalt: { deadline: 2000, at: 2000 }, closedAt: null });
});
it.each(['early', 'renewed', 'closed', 'reused', 'receipt'])('does not halt the %s neighbour', kind => {
  const f = fixture();
  if (kind === 'renewed') f.session.turnDeadline = 3000;
  if (kind === 'closed') f.session.closedAt = 1900;
  if (kind === 'reused') f.stamp('999:456');
  if (kind === 'receipt') f.events.push({ kind: 'turn-closed', at: 1500, receiptId: 'new' });
  expect(enforceSessionDeadline(f.io, f.name, f.identity, 2000, kind === 'early' ? 1999 : 2000)).toBe(false);
  expect(f.actions).toEqual([]);
});
it('does not act without durable cause and retains a failed closure for reconciliation', () => {
  const f = fixture(); f.failSave();
  expect(() => enforceSessionDeadline(f.io, f.name, f.identity, 2000, 2000)).toThrow('disk unavailable');
  expect(f.actions).toEqual([]);
  const g = fixture(); g.failKill();
  expect(() => enforceSessionDeadline(g.io, g.name, g.identity, 2000, 2000)).toThrow('closure unconfirmed');
  expect(g.state()).toHaveProperty('deadlineHalt');
});

it('executes the independent watchdog against the real durable session IO', async () => {
  const { mkdtempSync, writeFileSync, readFileSync, rmSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  // @ts-expect-error physical host outside pure core
  const { createProductionSessionIO } = await import('../../scripts/production-session-io.mjs');
  const root = mkdtempSync(join(tmpdir(), 'watchdog-halt-'));
  try {
    const name = `instar20-${'b'.repeat(24)}`, identity = `${name}:123:456`, tmuxPath = join(root, 'tmux');
    const journalFile = join(root, 'sessions.json'), proof = join(root, 'closed.json');
    writeFileSync(tmuxPath, `#!${process.execPath}\nimport {readFileSync,writeFileSync} from 'node:fs';\n`
      + `if(process.argv[2]==='display-message') process.stdout.write('123:456');\n`
      + `else if(process.argv[2]==='kill-session') {const row=JSON.parse(readFileSync(${JSON.stringify(journalFile)},'utf8')).sessions[0];`
      + `if(!row.deadlineHalt) process.exit(3);writeFileSync(${JSON.stringify(proof)},JSON.stringify(row));}\n`, { mode: 0o700 });
    const io = createProductionSessionIO({ stateDirectory: root, tmuxPath, home: root, configHome: root, cwd: root });
    const start = Date.now(), deadline = start + 1000;
    io.save({ sessions: [{ name, identity, turnDeadline: deadline, turnStartedAt: start, closedAt: null }], deliveries: [], resumes: {} });
    const result = spawnSync(process.execPath, ['scripts/session-deadline-watchdog.mjs', journalFile, io.inboxDirectory,
      tmuxPath, name, identity, String(deadline)], { encoding: 'utf8', timeout: 10000 });
    expect(result.status, result.stderr).toBe(0);
    const saved = JSON.parse(readFileSync(proof, 'utf8'));
    expect(saved).toMatchObject({ name, identity, closedAt: null, deadlineHalt: { deadline } });
    expect(saved.deadlineHalt.at).toBeGreaterThanOrEqual(deadline);
    expect(io.load().sessions[0]).toEqual(saved);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
