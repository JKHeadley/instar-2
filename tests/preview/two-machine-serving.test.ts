/** Rules 31, 63, 95: two runners (two machines) serving ONE conversation through the shared conversation
 * authority give exactly one reply per message and hand over without a duplicate or a lost message. Time is a
 * fake monotonic clock; Telegram is an offset-respecting fake that confirms (drops) updates below the offset. */
import { afterEach, describe, expect, it } from 'vitest';
import { appendFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { connectConversationAuthority, localAuthorityClient, openConversationAuthority, serveConversationAuthority } from './conversation-authority.js';
import type { AuthorityClient, ConversationAuthority } from './conversation-authority.js';
import { createSharedServing } from './two-machine-serving.js';

const TERM = 30_000;
const roots: string[] = [];
const authorities: ConversationAuthority[] = [];
afterEach(() => { for (const a of authorities.splice(0)) a.close(); for (const r of roots.splice(0)) rmSync(r, { recursive: true, force: true }); });

type Update = { update_id: number; text: string };
function world() {
  const root = mkdtempSync(join(tmpdir(), 'w3-twomachine-')); roots.push(root);
  const clock = { t: 1_000 };
  const path = join(root, 'authority.log');
  const open = () => { const a = openConversationAuthority({ path, conversation: 'telegram-test', termMs: TERM, monotonic: () => clock.t }); authorities.push(a); return a; };
  const authority = open();
  // Telegram: pending updates; a poll at offset N confirms (removes) every update below N.
  const pending: Update[] = [];
  const sends: { machine: string; update: number; text: string }[] = [];
  const polls: { machine: string; offset: number }[] = [];
  let next = 100;
  const say = (text: string) => { const u = { update_id: next++, text }; pending.push(u); return u.update_id; };
  const runner = (machine: string, client: AuthorityClient, options: { prepare?: (u: Update) => Promise<string | null>;
    send?: (u: Update) => Promise<'sent' | 'unknown'>; reachable?: () => boolean } = {}) => {
    const reachable = options.reachable ?? (() => true);
    const guarded: AuthorityClient = { request: async request => reachable() ? client.request(request) : { ok: false, reason: 'unreachable' } };
    return createSharedServing<Update>({ authority: guarded, machine, incarnation: `${machine}:1`, monotonic: () => clock.t, ports: {
      poll: async offset => { polls.push({ machine, offset }); for (let i = pending.length - 1; i >= 0; i--) if (pending[i]!.update_id < offset) pending.splice(i, 1);
        return pending.filter(u => u.update_id >= offset).slice(0, 8); },
      prepare: options.prepare ?? (async u => `reply to ${u.text}`),
      send: async (u, text) => { sends.push({ machine, update: u.update_id, text }); return options.send ? options.send(u) : 'sent'; } } });
  };
  const repliesPer = (update: number) => sends.filter(s => s.update === update).length;
  return { root, path, clock, authority, open, say, runner, sends, polls, pending, repliesPer };
}
const gate = () => { let release!: () => void; const promise = new Promise<void>(done => { release = done; }); return { promise, release }; };

describe('one conversation, two machines', () => {
  it('two runners give exactly one reply per message; the standby never polls or sends', async () => {
    const w = world();
    const studio = w.runner('studio', localAuthorityClient(w.authority)), laptop = w.runner('laptop', localAuthorityClient(w.authority));
    const ids = [w.say('one'), w.say('two'), w.say('three')];
    for (let i = 0; i < 4; i++) { await studio.tick(); await laptop.tick(); w.clock.t += 1_000; }
    for (const id of ids) expect(w.repliesPer(id)).toBe(1);
    expect(new Set(w.sends.map(s => s.machine))).toEqual(new Set(['studio']));
    expect(w.polls.every(p => p.machine === 'studio')).toBe(true);
    expect((await laptop.tick()).role).toBe('standby');
    expect(w.authority.handle({ op: 'read' })).toMatchObject({ ok: true, view: { cursor: ids[2]! + 1, unresolved: [] } });
  });

  it('owner stops mid-turn BEFORE the claim: the other machine takes over and replies once, nothing lost', async () => {
    const w = world();
    const hang = gate();
    const laptop = w.runner('laptop', localAuthorityClient(w.authority), { prepare: () => hang.promise.then(() => 'never') });
    const studio = w.runner('studio', localAuthorityClient(w.authority));
    const id = w.say('hello');
    void laptop.tick(); // the laptop owns, polls, and freezes inside its model work (process stopped)
    await new Promise(done => setImmediate(done));
    expect((await studio.tick()).role).toBe('standby');
    expect(w.repliesPer(id)).toBe(0);
    w.clock.t += TERM + 1; // the laptop's lease expires on the authority's clock
    const report = await studio.tick();
    expect(report).toMatchObject({ role: 'owner', sent: [id] });
    expect(w.repliesPer(id)).toBe(1);
    expect(w.authority.handle({ op: 'read' })).toMatchObject({ view: { epoch: 2, holder: { machine: 'studio' } } });
  });

  it('owner stops AFTER the claim, before the send: no duplicate; the update stays visibly unresolved; later messages flow', async () => {
    const w = world();
    const hang = gate();
    const laptop = w.runner('laptop', localAuthorityClient(w.authority), { send: () => hang.promise.then(() => 'sent' as const) });
    const studio = w.runner('studio', localAuthorityClient(w.authority));
    const first = w.say('first');
    void laptop.tick(); // claims `first`, then stops inside the physical send
    await new Promise(done => setTimeout(done, 5));
    w.clock.t += TERM + 1;
    const second = w.say('second');
    const report = await studio.tick();
    expect(report.skipped).toEqual([first]);
    expect(report.sent).toEqual([second]);
    expect(w.sends.filter(s => s.machine === 'studio').map(s => s.update)).toEqual([second]);
    expect(w.authority.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [`update:${first}`] } });
  });

  it('an in-flight send admitted before the handover completes once; the successor does not repeat it', async () => {
    const w = world();
    const hang = gate();
    const laptop = w.runner('laptop', localAuthorityClient(w.authority), { send: () => hang.promise.then(() => 'sent' as const) });
    const studio = w.runner('studio', localAuthorityClient(w.authority));
    const id = w.say('in flight');
    const stuck = laptop.tick();
    await new Promise(done => setTimeout(done, 5));
    w.clock.t += TERM + 1;
    await studio.tick();
    hang.release(); // the laptop resumes and its admitted send lands
    await stuck;
    expect(w.repliesPer(id)).toBe(1);
    expect(w.authority.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [] } });
  });

  it('a stale owner that comes back cannot claim, send or settle', async () => {
    const w = world();
    const laptop = w.runner('laptop', localAuthorityClient(w.authority)), studio = w.runner('studio', localAuthorityClient(w.authority));
    expect((await laptop.tick()).role).toBe('owner');
    const staleFence = laptop.fence()!;
    w.clock.t += TERM + 1; // the laptop was paused (lid closed) past its term
    await studio.tick();
    const id = w.say('while away');
    // The returning laptop's own clock still thinks it holds: the authority refuses its fenced operations anyway.
    expect(w.authority.handle({ op: 'claim', fence: staleFence, key: `update:${id}` })).toMatchObject({ ok: false, reason: 'stale' });
    expect(w.authority.handle({ op: 'settle', fence: staleFence, cursor: id + 1 })).toMatchObject({ ok: false, reason: 'stale' });
    expect(w.authority.handle({ op: 'renew', fence: staleFence })).toMatchObject({ ok: false, reason: 'stale' });
    expect((await laptop.tick()).role).toBe('standby');
    await studio.tick();
    expect(w.repliesPer(id)).toBe(1);
    expect(w.sends.every(s => s.machine === 'studio')).toBe(true);
  });

  it('a partition where each side thinks the other is gone yields one voice', async () => {
    const w = world();
    let cut = false;
    const laptop = w.runner('laptop', localAuthorityClient(w.authority), { reachable: () => !cut });
    const studio = w.runner('studio', localAuthorityClient(w.authority));
    expect((await laptop.tick()).role).toBe('owner');
    cut = true; // the laptop loses the authority machine but can still reach Telegram
    const id = w.say('during the partition');
    w.clock.t += TERM / 3 + 1;
    expect((await laptop.tick()).role).not.toBe('owner'); // renewal and the cursor read fail: it neither polls nor sends
    w.clock.t += TERM;
    const laptopPolls = w.polls.filter(p => p.machine === 'laptop').length;
    expect((await laptop.tick()).role).toBe('inhibited'); // its own term has lapsed; it stays quiet
    expect(w.polls.filter(p => p.machine === 'laptop').length).toBe(laptopPolls);
    expect((await studio.tick())).toMatchObject({ role: 'owner', sent: [id] });
    cut = false; // healed: the laptop finds itself replaced
    expect((await laptop.tick()).role).toBe('standby');
    expect(w.repliesPer(id)).toBe(1);
  });

  it('a runner partitioned from the authority never acquires; the other side serves', async () => {
    const w = world();
    const laptop = w.runner('laptop', localAuthorityClient(w.authority), { reachable: () => false });
    const studio = w.runner('studio', localAuthorityClient(w.authority));
    const id = w.say('hi');
    expect((await laptop.tick()).role).toBe('inhibited');
    expect((await studio.tick()).sent).toEqual([id]);
    expect(w.polls.some(p => p.machine === 'laptop')).toBe(false);
  });

  it('a lost settle leaves the update for redelivery; the second pass skips it rather than re-sending', async () => {
    const w = world();
    let settleDown = true;
    const client = localAuthorityClient(w.authority);
    const flaky: AuthorityClient = { request: async r => r.op === 'settle' && settleDown ? { ok: false, reason: 'unreachable' } : client.request(r) };
    const studio = w.runner('studio', flaky);
    const id = w.say('once');
    expect((await studio.tick()).sent).toEqual([id]);
    settleDown = false;
    w.clock.t += 1_000;
    expect((await studio.tick())).toMatchObject({ sent: [], skipped: [id], settled: id + 1 });
    expect(w.repliesPer(id)).toBe(1);
  });
  it('a lost outcome AND a lost settle never let the same owner send the update twice', async () => {
    const w = world();
    let settleAttempts = 0;
    const client = localAuthorityClient(w.authority);
    const flaky: AuthorityClient = { request: async r =>
      r.op === 'outcome' || (r.op === 'settle' && settleAttempts++ === 0) ? { ok: false, reason: 'unreachable' } : client.request(r) };
    const studio = w.runner('studio', flaky);
    const id = w.say('once');
    expect((await studio.tick()).sent).toEqual([id]);
    w.clock.t += 1_000;
    expect((await studio.tick())).toMatchObject({ sent: [], skipped: [id], settled: id + 1 });
    expect(w.repliesPer(id)).toBe(1);
    expect(w.authority.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [`update:${id}`] } });
  });

  it('a lost claim acknowledgement sends nothing and leaves the update honestly unresolved', async () => {
    const w = world();
    let claimLost = true;
    const client = localAuthorityClient(w.authority);
    const flaky: AuthorityClient = { request: async r => {
      const answer = await client.request(r);
      if (r.op === 'claim' && claimLost) { claimLost = false; return { ok: false, reason: 'unreachable' }; }
      return answer;
    } };
    const studio = w.runner('studio', flaky);
    const id = w.say('once');
    expect((await studio.tick())).toMatchObject({ role: 'inhibited', sent: [] });
    w.clock.t += 1_000;
    expect((await studio.tick())).toMatchObject({ sent: [], skipped: [id], settled: id + 1 });
    expect(w.repliesPer(id)).toBe(0);
    expect(w.authority.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [`update:${id}`] } });
  });
});

describe('the authority itself', () => {
  it('commits break-before-make epochs, refuses copied fences, and never resets the epoch on restart', async () => {
    const w = world();
    const a = w.authority.handle({ op: 'acquire', machine: 'laptop', incarnation: 'laptop:1' });
    expect(a).toMatchObject({ ok: true, fence: { epoch: 1 } });
    expect(w.authority.handle({ op: 'acquire', machine: 'studio', incarnation: 'studio:1' })).toMatchObject({ ok: false, reason: 'held' });
    // The same epoch presented by another incarnation is not the fence.
    expect(w.authority.handle({ op: 'claim', fence: { epoch: 1, incarnation: 'studio:1' }, key: 'update:5' })).toMatchObject({ ok: false, reason: 'stale' });
    expect(w.authority.handle({ op: 'claim', fence: { epoch: 1, incarnation: 'laptop:1' }, key: 'update:5' })).toMatchObject({ ok: true });
    // Consumed once: the claimant asking again (a lost acknowledgement) is not handed a second send.
    expect(w.authority.handle({ op: 'claim', fence: { epoch: 1, incarnation: 'laptop:1' }, key: 'update:5' })).toMatchObject({ ok: false, reason: 'already-claimed', state: 'claimed' });
    w.authority.close();
    // Restart: the recorded lease is held for one full term from the restart, then the epoch advances, never resets.
    const reopened = w.open();
    expect(reopened.handle({ op: 'acquire', machine: 'studio', incarnation: 'studio:1' })).toMatchObject({ ok: false, reason: 'held' });
    w.clock.t += TERM + 1;
    expect(reopened.handle({ op: 'acquire', machine: 'studio', incarnation: 'studio:1' })).toMatchObject({ ok: true, fence: { epoch: 2 } });
    expect(reopened.handle({ op: 'claim', fence: { epoch: 2, incarnation: 'studio:1' }, key: 'update:5' })).toMatchObject({ ok: false, reason: 'already-claimed', state: 'claimed' });
    // The old claimant may still report its in-flight outcome; nobody else may.
    expect(reopened.handle({ op: 'outcome', fence: { epoch: 2, incarnation: 'studio:1' }, key: 'update:5', state: 'sent' })).toMatchObject({ ok: false, reason: 'not-claimant' });
    expect(reopened.handle({ op: 'outcome', fence: { epoch: 1, incarnation: 'laptop:1' }, key: 'update:5', state: 'unknown' })).toMatchObject({ ok: true });
    expect(reopened.handle({ op: 'read' })).toMatchObject({ view: { unresolved: [], claims: 1 } });
  });

  it('a torn final line is cut; a broken chain leaves the authority unable to issue anything', () => {
    const w = world();
    w.authority.handle({ op: 'acquire', machine: 'studio', incarnation: 'studio:1' });
    w.authority.close();
    appendFileSync(w.path, '{"seq":3,"prev":"x');
    expect(w.open().handle({ op: 'read' })).toMatchObject({ ok: true, view: { epoch: 1 } });
    authorities.splice(0).forEach(a => a.close());
    const lines = readFileSync(w.path, 'utf8').split('\n');
    lines[1] = lines[1]!.replace('"studio"', '"laptop"');
    writeFileSync(w.path, lines.join('\n'));
    const broken = w.open();
    expect(broken.handle({ op: 'read' })).toEqual({ ok: false, reason: 'corrupt' });
    expect(broken.handle({ op: 'acquire', machine: 'studio', incarnation: 'studio:2' })).toEqual({ ok: false, reason: 'corrupt' });
  });

  it('over HTTP: a real round trip serves; a wrong secret or conversation is refused; a dead authority is unreachable', async () => {
    const w = world();
    const token = 'x'.repeat(32);
    const server = await serveConversationAuthority({ authority: w.authority, token, host: '127.0.0.1', port: 0 });
    try {
      const port = (server.address() as { port: number }).port, url = `http://127.0.0.1:${port}`;
      const client = connectConversationAuthority({ url, token, conversation: 'telegram-test', timeoutMs: 2_000 });
      const studio = w.runner('studio', client);
      const id = w.say('over the wire');
      expect((await studio.tick()).sent).toEqual([id]);
      expect(await connectConversationAuthority({ url, token: 'y'.repeat(32), conversation: 'telegram-test', timeoutMs: 2_000 })
        .request({ op: 'read' })).toEqual({ ok: false, reason: 'unauthorized' });
      expect(await connectConversationAuthority({ url, token, conversation: 'telegram-other', timeoutMs: 2_000 })
        .request({ op: 'read' })).toEqual({ ok: false, reason: 'invalid' });
    } finally { await new Promise(done => server.close(done)); }
    const gone = connectConversationAuthority({ url: 'http://127.0.0.1:9', token, conversation: 'telegram-test', timeoutMs: 500 });
    expect(await gone.request({ op: 'read' })).toEqual({ ok: false, reason: 'unreachable' });
  });
});
