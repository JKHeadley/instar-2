/** Isolated provider proof: actual loopback requests/receipts, never live Telegram.
 * Candidate bytes are the retained D1c shape (46039703); transport failures below
 * are injected controls, not a claim about the historical lost cause. */
import { expect, it } from 'vitest';
import { createServer } from 'node:http';
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createJournalWorker, openPreviewJournal, sendOutcomeCounts } from './journal-test-worker.js';
import { classifyTelegramSend } from './telegram-send-outcome.mjs';
import { settleSendOutcome, type SendOutcome } from './outbound-provenance.js';
import { recoveryDelay, BACKOFF_SCHEDULE_MS, TTL_MS } from './delivery-recovery.js';
import { openConversationAuthority } from './conversation-authority.js';

const key = new Uint8Array(32).fill(7);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321', grant: 'grant:preview',
  configurationDigest: 'sha256:offline', expires: 9999999999999, maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 };
const update = { update_id: 46039703, message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text: 'hi' } };
const fixture = JSON.parse(readFileSync(new URL('./fixtures/deferral-send-failure-2026-10-08.json', import.meta.url), 'utf8')) as { candidate: string };

it.each(['accepted', 'lost', 'corrupt'] as const)('isolated refused → restart → %s receipt preserves exact identity and no duplicates', async final => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-recovery-'));
  let now = 1000, requests = 0, delivered = 0;
  const bodies: string[] = [], signatures: unknown[] = [];
  const server = createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += String(chunk); }); req.on('end', () => {
      requests++; bodies.push(body); const input = JSON.parse(body) as { chat: string; expectedText: string; provenance: unknown };
      signatures.push(input.provenance);
      if (requests === 1) { res.writeHead(429); res.end(JSON.stringify({ ok: false, parameters: { retry_after: 30 } })); return; }
      delivered++;
      if (final === 'lost') { req.socket.destroy(); return; }
      res.end(JSON.stringify({ ok: true, result: { message_id: 77, chat: { id: Number(input.chat) },
        text: final === 'corrupt' ? 'different body' : input.expectedText } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
    model: async () => fixture.candidate.replace(/^PREVIEW — /u, ''),
    send: async input => {
      // No infrastructure delivery notice is sent to the endpoint under test.
      if (input.target?.startsWith('delivery-notice:')) return 99;
      try { const result = await fetch(endpoint, { method: 'POST', body: JSON.stringify({ text: input.text,
        expectedText: input.expectedText, chat: input.chat, target: input.target, provenance: input.provenance }) });
        return classifyTelegramSend({ kind: 'response', status: result.status, bytes: await result.text() }, input);
      } catch { return { kind: 'unknown', reason: 'isolated endpoint lost response' }; }
    } });
  try {
    const first = worker(); first.intake([update]); await first.drain();
    expect(requests).toBe(1); expect(journal.view.order[0]!.sent).toBeUndefined();
    expect(journal.view.sendOutcomes[0]?.recovery?.nextAt).toBe(31000);
    journal.close(); journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    const second = worker(); now = 30999; await second.drain(); expect(requests).toBe(1);
    now = 31000; await second.drain(); expect(requests).toBe(2); expect(delivered).toBe(1);
    expect(bodies[1]).toBe(bodies[0]); expect(signatures[1]).toEqual(signatures[0]);
    expect(journal.view.order[0]!.sent).toBe(final === 'accepted' ? 77 : undefined);
    if (final !== 'accepted') expect(sendOutcomeCounts(journal.view).unknown).toBe(1);
    journal.close(); journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    now += TTL_MS; await worker().drain(); expect(requests).toBe(2);
  } finally { journal.close(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); }
});

it('preserves only validated Telegram retry metadata through settlement', () => {
  for (const seconds of [30, 0, -1, 1.2, '30', Number.MAX_SAFE_INTEGER]) {
    const outcome = settleSendOutcome(classifyTelegramSend({ kind: 'response', status: 429,
      bytes: JSON.stringify({ ok: false, parameters: { retry_after: seconds } }) }, { chat: '1', expectedText: 'x' }));
    expect(outcome).toEqual({ kind: 'refused', reason: 'telegram 429', ...(seconds === 30 ? { retryAfterMs: 30000 } : {}) });
  }
  expect(recoveryDelay({ kind: 'unknown', reason: 'lost' }, 1, 0, 100)).toBeNull();
  expect(recoveryDelay({ kind: 'refused', reason: 'denied' }, 1, 0, 100)).toBeNull();
  expect(BACKOFF_SCHEDULE_MS).toEqual([30000,60000,120000,300000,900000,1800000,3600000,7200000,14400000]);
  for (let attempt = 1; attempt < 9; attempt++) expect(recoveryDelay({ kind: 'not-sent', reason: 'connect' }, attempt, 0, 100)).toBe(BACKOFF_SCHEDULE_MS[attempt - 1]);
  expect(recoveryDelay({ kind: 'not-sent', reason: 'connect' }, 9, 0, 100)).toBeNull();
  expect(recoveryDelay({ kind: 'not-sent', reason: 'connect' }, 1, 0, TTL_MS)).toBeNull();
});

it('authority CAS permits only proved non-delivery at the next ordinal, including restart/handoff', () => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-claim-')); let now = 0;
  const open = () => openConversationAuthority({ path: join(dir, 'authority'), conversation: 'row07', termMs: 1000, monotonic: () => now });
  let authority = open();
  try {
    const first = authority.handle({ op: 'acquire', machine: 'a', incarnation: 'a:1' });
    if (!first.ok || !first.fence) throw Error('lease'); const fence = first.fence;
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence })).toMatchObject({ ok: true });
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence, attempt: 1 })).toMatchObject({ ok: false });
    expect(authority.handle({ op: 'outcome', key: 'reply:1', fence, state: 'retryable' })).toMatchObject({ ok: true });
    authority.close(); authority = open(); now = 2000;
    const second = authority.handle({ op: 'acquire', machine: 'b', incarnation: 'b:1' });
    if (!second.ok || !second.fence) throw Error('lease'); const successor = second.fence;
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence, attempt: 1 })).toMatchObject({ ok: false, reason: 'stale' });
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence: successor, attempt: 2 })).toMatchObject({ ok: false });
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence: successor, attempt: 1 })).toMatchObject({ ok: true });
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence: successor, attempt: 1 })).toMatchObject({ ok: false });
    expect(authority.handle({ op: 'outcome', key: 'reply:1', fence, state: 'sent' })).toMatchObject({ ok: false });
    expect(authority.handle({ op: 'outcome', key: 'reply:1', fence: successor, state: 'sent' })).toMatchObject({ ok: false });
    expect(authority.handle({ op: 'outcome', key: 'reply:1', fence: successor, attempt: 1, state: 'unknown' })).toMatchObject({ ok: true });
    expect(authority.handle({ op: 'claim', key: 'reply:1', fence: successor, attempt: 2 })).toMatchObject({ ok: false, state: 'unknown' });
  } finally { authority.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('exhausts recovery durably, sends one actionable notice, and never exposes the queued body in status', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-exhaust-')); let now = 1000, physical = 0, notices = 0;
  let journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => fixture.candidate,
    send: async input => { if (input.target?.startsWith('delivery-notice:')) { notices++; return 123; }
      physical++; return { kind: 'not-sent', reason: 'isolated connection never opened' }; } });
  try {
    const first = worker(); first.intake([update]); await first.drain();
    expect(physical).toBe(2); expect(notices).toBe(0);
    const status = sendOutcomeCounts(journal.view);
    expect(status).toMatchObject({ recovery: { queued: 1, uncertain: 0 } });
    expect(JSON.stringify(status)).not.toContain(fixture.candidate);
    expect(status.lastRefusal).not.toHaveProperty('recovery');
    for (let attempt = 2; attempt < 9; attempt++) {
      const r = journal.view.sendOutcomes[0]?.recovery;
      expect(r?.attempts).toBe(attempt); now = r!.nextAt;
      journal.close(); journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
      await worker().drain();
    }
    expect(physical).toBe(9); expect(notices).toBe(1);
    expect(journal.view.sendOutcomes[0]).toMatchObject({ outcome: 'refused', reason: expect.stringContaining('exhausted') });
    expect(journal.view.sendOutcomes[0]).not.toHaveProperty('recovery');
    now += TTL_MS; await worker().drain(); expect(physical).toBe(9); expect(notices).toBe(1);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it.each(['stop', 'expiry', 'secret', 'denied', 'ttl'] as const)('recovery respects the %s boundary', async boundary => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-floor-')); let now = 1000, stopped = false, secret = false, calls = 0;
  const journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, { ...genesis, ...(boundary === 'expiry' ? { expires: 61000 } : {}) });
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => stopped, checkOutbound: () => { if (secret) throw Error('secret refused'); },
    model: async () => 'retained answer', send: async input => {
      if (input.target?.startsWith('delivery-notice:')) return 99;
      calls++; return calls <= 2 ? { kind: 'not-sent', reason: 'connect' } : { kind: 'refused', reason: 'current ownership denied' };
    } });
  try {
    worker.intake([update]); await worker.drain(); expect(calls).toBe(2);
    now = boundary === 'ttl' ? 1000 + TTL_MS : 61000;
    if (boundary === 'stop') stopped = true;
    if (boundary === 'secret') secret = true;
    await worker.drain().catch(error => { expect(String(error)).toMatch(/stop|expir|secret/iu); });
    expect(calls).toBe(boundary === 'denied' ? 3 : 2);
    if (boundary === 'ttl' || boundary === 'denied') expect(journal.view.sendOutcomes[0]).not.toHaveProperty('recovery');
    expect(journal.view.order[0]?.sent).toBeUndefined();
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('a durable recovery start without its result is UNKNOWN after restart, never a fresh retry', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-crash-')); let now = 1000;
  let journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
  try {
    const first = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => 'answer',
      send: async () => ({ kind: 'not-sent', reason: 'connection' }) });
    first.intake([update]); await first.drain();
    const pending = journal.view.sendOutcomes[0]!, r = pending.recovery!; now = r.nextAt;
    journal.append({ kind: 'send-recovery', target: pending.target, attempt: r.attempts, action: 'start', at: now });
    expect(() => journal.append({ kind: 'send-recovery', target: pending.target, attempt: r.attempts, action: 'start', at: now })).toThrow('not eligible');
    journal.close(); journal = openPreviewJournal(join(dir, 'journal.encrypted'), key, genesis);
    let replySends = 0;
    const second = createJournalWorker(journal, { now: () => now + TTL_MS, stopped: () => false, checkOutbound: () => {}, model: async () => { throw Error('model repeated'); },
      send: async input => { if (input.target?.startsWith('reply:')) replySends++; return 88; } });
    await second.drain(); expect(replySends).toBe(0);
    expect(sendOutcomeCounts(journal.view)).toMatchObject({ unknown: 1, recovery: { queued: 0, uncertain: 1 } });
    expect(() => journal.append({ kind: 'send-recovery', target: pending.target, attempt: r.attempts - 1, action: 'finish', outcome: { kind: 'accepted', message: 42 }, at: now })).toThrow('recovery order');
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('rate-limit waits retain the inherited regular budget but never outlive TTL', () => {
  const limited: SendOutcome = { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 };
  expect(recoveryDelay(limited, 0, 0, 100)).toBe(30000);
  expect(recoveryDelay(limited, 9, 0, 100)).toBe(30000);
  expect(recoveryDelay(limited, 0, 0, TTL_MS - 1)).toBe(1);
  expect(recoveryDelay(limited, 0, 0, TTL_MS)).toBeNull();
});

it.each(['receipt', 'collection-lost'] as const)('replicated recovery preserves identity across handoff with %s', async receiptMode => {
  const { localAuthorityClient } = await import('./conversation-authority.js');
  const { createLeaseHolder } = await import('./two-machine-serving.js');
  const { openReplicaStore, localReplicaClient, createJournalShipper, createReplicatedDispatch, adoptReceivedCopy } = await import('./journal-replication.js');
  const dir = mkdtempSync(join(tmpdir(), 'delivery-handoff-'));
  const secret = 'row07-replication-isolated-secret', conversation = 'row07'; let now = 1000, requests = 0;
  const server = createServer((req, res) => {
    let bytes = ''; req.on('data', chunk => { bytes += String(chunk); }); req.on('end', () => {
      requests++; const body = JSON.parse(bytes) as { chat: string; expectedText: string };
      if (requests === 1) { res.writeHead(429); res.end(JSON.stringify({ ok: false, parameters: { retry_after: 30 } })); }
      else res.end(JSON.stringify({ ok: true, result: { message_id: 123, chat: { id: Number(body.chat) }, text: body.expectedText } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const authority = openConversationAuthority({ path: join(dir, 'authority'), conversation, termMs: 300000, monotonic: () => now });
  const client = localAuthorityClient(authority);
  const aRoot = join(dir, 'a'), bRoot = join(dir, 'b');
  const aStore = openReplicaStore({ directory: join(aRoot, 'replica'), conversation, machine: 'a', secret });
  const bStore = openReplicaStore({ directory: join(bRoot, 'replica'), conversation, machine: 'b', secret });
  let journal = openPreviewJournal(join(aRoot, 'journal'), key, genesis);
  const first = createLeaseHolder({ authority: client, machine: 'a', incarnation: 'a:1', monotonic: () => now });
  const second = createLeaseHolder({ authority: client, machine: 'b', incarnation: 'b:1', monotonic: () => now });
  const sentSubjects: unknown[] = [];
  try {
    await first.hold();
    const shipper = createJournalShipper({ path: join(aRoot, 'journal'), size: () => journal.size,
      peer: localReplicaClient(bStore), conversation, machine: 'a', secret, epoch: () => first.fence()?.epoch ?? null, monotonic: () => now });
    const dispatch = (lease: typeof first, shipping: typeof shipper) => createReplicatedDispatch({ authority: client, lease, shipper: shipping,
      cursor: 0, sleep: async ms => { now += ms; }, elapsed: () => now });
    let gate = dispatch(first, shipper);
    const worker = (lease: typeof first) => createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => fixture.candidate,
      reconcileSend: (target, subject) => gate.reconcile(target, subject),
      send: async input => {
        if (input.target?.startsWith('delivery-notice:')) return 99;
        const refuse = await gate.admit(input.target!, () => lease.fence() ? null : 'owner lost', undefined, input.retryAttempt, input.provenance!.contentHash);
        if (refuse) return refuse;
        sentSubjects.push({ target: input.target, provenance: input.provenance, text: input.text });
        const response = await fetch(endpoint, { method: 'POST', body: JSON.stringify(input) });
        const result = classifyTelegramSend({ kind: 'response', status: response.status, bytes: await response.text() }, input);
        await gate.outcome(input.target!, result.kind, result.kind === 'refused' && result.retryAfterMs !== undefined,
          result.kind === 'accepted' ? { message: result.message, subject: input.provenance!.contentHash } : undefined);
        return result.kind === 'accepted' && receiptMode === 'collection-lost' ? { kind: 'unknown', reason: 'local collection interrupted' } : result;
      } });
    const w = worker(first); w.intake([update]); await w.drain();
    expect(requests).toBe(1); expect(await shipper.drain()).toBe(true);
    journal.close(); await first.release(); await second.hold();
    const adopted = adoptReceivedCopy({ root: bRoot, journalPath: join(bRoot, 'journal'), store: bStore, epoch: second.fence()!.epoch, seed: false,
      verify: path => { const read = openPreviewJournal(path, key, undefined, undefined, true); read.close(); } });
    expect(adopted).toMatchObject({ ok: true, how: 'adopted' });
    journal = openPreviewJournal(join(bRoot, 'journal'), key);
    const shipping = createJournalShipper({ path: join(bRoot, 'journal'), size: () => journal.size,
      peer: localReplicaClient(aStore), conversation, machine: 'b', secret, epoch: () => second.fence()?.epoch ?? null, monotonic: () => now });
    gate = dispatch(second, shipping); now = 30999; await worker(second).drain(); expect(requests).toBe(1);
    now = 31000; await worker(second).drain(); expect(requests).toBe(2);
    expect(sentSubjects[1]).toEqual(sentSubjects[0]);
    if (receiptMode === 'collection-lost') {
      expect(journal.view.order[0]?.sent).toBeUndefined();
      journal.close(); journal = openPreviewJournal(join(bRoot, 'journal'), key, genesis);
      await worker(second).drain();
    }
    expect(journal.view.order[0]?.sent).toBe(123);
    expect(authority.handle({ op: 'claim', fence: second.fence()!, key: `reply:${journal.view.order[0]!.id}`, attempt: 2 })).toMatchObject({ ok: false, state: 'sent' });
    await worker(second).drain(); expect(requests).toBe(2);
  } finally { journal.close(); authority.close(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); }
});

it('the existing next-due wake resumes queued recovery without a new intake or timer owner', async () => {
  const { nextDeliveryRecoveryAt } = await import('./journal.js');
  const { createNextDueWake } = await import('../../src/transport/index.js');
  const dir = mkdtempSync(join(tmpdir(), 'delivery-wake-')); let now = 1000, sends = 0;
  const journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  let fire: (() => void) | null = null, delay = 0, running = Promise.resolve();
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => 'answer',
    send: async () => ++sends === 1 ? { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 } : 77 });
  const wake = createNextDueWake({ now: () => now, next: () => nextDeliveryRecoveryAt(journal.view),
    after: (ms, callback) => { delay = ms; fire = callback; return () => { fire = null; }; }, wake: () => { running = worker.drain(); } });
  try {
    worker.intake([update]); await worker.drain(); wake.refresh(); expect(delay).toBe(30000);
    now = 30999; (fire as unknown as () => void)(); await running; expect(sends).toBe(1);
    now = 31000; (fire as unknown as () => void)(); await running; expect(sends).toBe(2);
    wake.refresh(); expect(nextDeliveryRecoveryAt(journal.view)).toBeNull(); expect(fire).toBeNull();
  } finally { wake.close(); journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it.each(['reply', 'delivery-notice'].flatMap(kind => ['matching', 'wrong-subject', 'absent'].map(evidence => ({ kind, evidence }))))(
  'restart reconciles only a persisted $evidence $kind receipt without a second send', async ({ kind, evidence }) => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-reconcile-'));
  let now = 1000, sends = 0;
  const authorityPath = join(dir, 'authority');
  let authority = openConversationAuthority({ path: authorityPath, conversation: 'row07', termMs: 300000, monotonic: () => now });
  const acquired = authority.handle({ op: 'acquire', machine: 'a', incarnation: 'a:1' });
  if (!acquired.ok || !acquired.fence) throw Error('lease missing');
  const fence = acquired.fence;
  let journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => fixture.candidate,
    send: async input => {
      if (!input.target?.startsWith(`${kind}:`)) return kind === 'reply' ? 99 : { kind: 'refused', reason: 'telegram 403' };
      sends++;
      expect(authority.handle({ op: 'claim', fence, key: input.target!, subject: input.provenance!.contentHash })).toMatchObject({ ok: true });
      if (evidence !== 'absent') {
        const receipt = { message: 77, subject: evidence === 'matching' ? input.provenance!.contentHash : `sha256:${'f'.repeat(64)}` };
        expect(authority.handle({ op: 'outcome', fence, key: input.target!, state: 'sent', receipt })).toMatchObject({ ok: evidence === 'matching' });
      }
      return { kind: 'unknown', reason: 'local receipt collection interrupted' };
    } });
  try {
    worker.intake([update]); await worker.drain(); expect(sends).toBe(1);
    const turn = journal.view.order[0]!, target = `${kind}:${turn.id}`, subject = journal.view.sendEvidence![target]!.provenance.contentHash;
    expect(turn.sent).toBeUndefined();
    journal.close(); authority.close(); now++;
    authority = openConversationAuthority({ path: authorityPath, conversation: 'row07', termMs: 300000, monotonic: () => now });
    now += 300001; // Restart conservatively holds the previous lease for a full term.
    const next = authority.handle({ op: 'acquire', machine: 'b', incarnation: 'b:1' });
    if (!next.ok || !next.fence) throw Error('successor lease missing');
    expect(authority.handle({ op: 'receipt', fence, key: target, subject })).toMatchObject({ ok: false });
    expect(authority.handle({ op: 'receipt', fence: next.fence, key: target, subject: 'wrong' })).toEqual({ ok: true });
    journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
    const second = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => { throw Error('no model'); },
      reconcileSend: async (key, hash) => {
        const answer = authority.handle({ op: 'receipt', fence: next.fence!, key, subject: hash });
        return answer.ok ? answer.receipt?.message ?? null : null;
      }, send: async () => { sends++; throw Error('must not resend'); } });
    await second.drain(); await second.drain();
    const result = journal.view.order[0]!;
    expect(kind === 'reply' ? result.sent : result.deliveryNotice?.sent).toBe(evidence === 'matching' ? 77 : undefined); expect(sends).toBe(1);
    if (evidence === 'matching') expect(() => journal.append({ kind: 'send-reconciled', target, subject, message: 77, at: now })).toThrow(/reconciliation/);
  } finally { journal.close(); authority.close(); rmSync(dir, { recursive: true, force: true }); }
});

it.each(['withdrawn', 'unsettled'] as const)('a queued requested reply stays behind the %s authority fence', async boundary => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-withdraw-'));
  const start = Date.UTC(2026, 8, 26, 17), due = Date.UTC(2026, 9, 2, 16);
  let now = start, attempted = 0;
  const journal = openPreviewJournal(join(dir, 'journal'), key, { ...genesis, expires: due + TTL_MS });
  const request = 'remind me Friday at 9 am to call Priya';
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
    model: async input => {
      if (input.id.startsWith('requested-action:')) return 'Call Priya.';
      if (input.question === request) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [{ quote: request, when: 'Friday at 9 am', remind: true }] });
      if (boundary === 'unsettled') return { state: 'uncertain' };
      const reminders = (JSON.parse(input.context) as { reminders?: { id: string }[] }).reminders ?? [];
      return JSON.stringify({ reply: 'Cancelled.', memory: [], cancelReminders: reminders.map(item => ({ id: item.id, quote: 'cancel the Priya reminder' })) });
    }, send: async input => {
      if (input.target?.startsWith('reply:requested-action:')) { attempted++; return { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 }; }
      return 77;
    } });
  try {
    worker.intake([{ ...update, message: { ...update.message, text: request, date: start / 1000 } }]); await worker.drain();
    now = due; await worker.sendRequested(); expect(attempted).toBe(1);
    now += 30000;
    worker.intake([{ update_id: update.update_id + 1, message: { ...update.message, text: 'cancel the Priya reminder', date: now / 1000 } }]);
    await worker.drain(); await worker.drain(); expect(attempted).toBe(1);
    const outcome = journal.view.sendOutcomes.find(item => item.target.startsWith('reply:requested-action:'))!;
    expect(outcome).toBeDefined();
    if (boundary === 'withdrawn') { expect(outcome.reason).toBe('requested action withdrawn before recovery'); expect(outcome).not.toHaveProperty('recovery'); }
    else expect(outcome.recovery).toBeDefined();
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('claim receipts reject corrupt, conflicting and unsigned evidence and cannot be mutated by a reader', () => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-receipt-owner-'));
  const authority = openConversationAuthority({ path: join(dir, 'authority'), conversation: 'row07', termMs: 1000, monotonic: () => 0 });
  try {
    const acquired = authority.handle({ op: 'acquire', machine: 'a', incarnation: 'a:1' });
    if (!acquired.ok || !acquired.fence) throw Error('lease');
    const fence = acquired.fence, subject = `sha256:${'a'.repeat(64)}`, other = `sha256:${'b'.repeat(64)}`, key = 'reply:1';
    expect(authority.handle({ op: 'claim', fence, key, subject })).toMatchObject({ ok: true });
    for (const receipt of [{ message: 0, subject }, { message: 1.5, subject }, { message: 7, subject: other }])
      expect(authority.handle({ op: 'outcome', fence, key, state: 'sent', receipt })).toMatchObject({ ok: false, reason: 'invalid' });
    const receipt = { message: 7, subject };
    expect(authority.handle({ op: 'outcome', fence, key, state: 'sent', receipt })).toMatchObject({ ok: true });
    receipt.message = 8;
    expect(authority.handle({ op: 'outcome', fence, key, state: 'sent', receipt })).toMatchObject({ ok: false });
    const answer = authority.handle({ op: 'receipt', fence, key, subject });
    expect(answer).toMatchObject({ ok: true, receipt: { message: 7, subject } });
    if (answer.ok && answer.receipt) answer.receipt.message = 9;
    expect(authority.handle({ op: 'receipt', fence, key, subject })).toMatchObject({ receipt: { message: 7 } });
    expect(authority.handle({ op: 'claim', fence, key, attempt: 1, subject })).toMatchObject({ ok: false, state: 'sent' });
  } finally { authority.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('a recorded long reply recovers only its refused continuation and preserves the delivered first part', async () => {
  const recorded = JSON.parse(readFileSync(new URL('./fixtures/status-reply-split-live-2026-10-03.json', import.meta.url), 'utf8')) as { statusAnswers: { update: number; answer: string }[] };
  const answer = recorded.statusAnswers.find(row => row.update === 6232050)!.answer;
  const dir = mkdtempSync(join(tmpdir(), 'delivery-part-recovery-'));
  let now = 1000, calls = 0;
  let journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  const inputs: { target?: string; provenance?: unknown; text: string }[] = [];
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => answer,
    send: async input => { inputs.push(input); calls++; return calls === 2 ? { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 } : calls; } });
  try {
    const first = worker(); first.intake([update]); await first.drain();
    expect(calls).toBe(2); expect(journal.view.order[0]!.sent).toBe(1);
    expect(journal.view.order[0]!.replyParts?.[0]?.sent).toBeUndefined();
    journal.close(); journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
    now = 31000; await worker().drain();
    expect(calls).toBe(3); expect(inputs[2]?.target).toBe(inputs[1]?.target);
    expect(inputs[2]?.provenance).toEqual(inputs[1]?.provenance); expect(inputs[2]?.text).toBe(inputs[1]?.text);
    expect(journal.view.order[0]!.sent).toBe(1); expect(journal.view.order[0]!.replyParts?.[0]?.sent).toBe(3);
    expect(sendOutcomeCounts(journal.view)).toMatchObject({ accepted: 2, unknown: 0 });
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it('rechecks visible reply bytes against current secrets even when transport markup escapes them', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-secret-recheck-'));
  let now = 1000, currentSecret = false, calls = 0;
  const journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
    checkOutbound: text => { if (currentSecret && text.includes('<new-secret>')) throw Error('secret refused'); },
    model: async () => 'Retained <new-secret>', send: async () => { calls++; return { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 }; } });
  try {
    worker.intake([update]); await worker.drain(); expect(calls).toBe(1);
    const queued = journal.view.sendOutcomes[0]!.recovery!;
    expect(queued.input.text).not.toContain('<new-secret>'); expect(queued.input.expectedText).toContain('<new-secret>');
    now = 31000; currentSecret = true;
    await expect(worker.drain()).rejects.toThrow('secret refused'); expect(calls).toBe(1);
    expect(queued.started).toBeUndefined();
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it.each(['not-sent', 'rate-limited'] as const)('a failed %s escalation cannot enter the reply recovery schedule', async failure => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-notice-bound-'));
  let now = 1000, notices = 0;
  const journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => 'answer',
    send: async input => {
      if (!input.target?.startsWith('delivery-notice:')) return { kind: 'refused', reason: 'telegram 403' };
      notices++; return failure === 'not-sent' ? { kind: 'not-sent', reason: 'connection refused' } : { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 };
    } });
  try {
    worker.intake([update]); await worker.drain();
    expect(notices).toBe(failure === 'not-sent' ? 2 : 1);
    expect(journal.view.sendOutcomes.every(item => item.recovery === undefined)).toBe(true);
    now += TTL_MS; await worker.drain(); expect(notices).toBe(failure === 'not-sent' ? 2 : 1);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});


it.each(['rotation', 'operator'] as const)('five failed escalations suspend the scope across handoff until %s resume', async resume => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-pressure-'));
  let now = 1000, notices = 0, replies = 0, configuration: string | null = `sha256:${'1'.repeat(64)}`;
  let journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  const worker = () => createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {},
    recoveryConfiguration: () => configuration, model: async () => 'Retained response', send: async input => {
      if (input.target?.startsWith('delivery-notice:')) { notices++; return { kind: 'refused', reason: 'telegram 403' }; }
      replies++; return replies > 5 ? { kind: 'refused', reason: 'telegram 429', retryAfterMs: 30000 } : { kind: 'refused', reason: 'telegram 403' };
    } });
  try {
    for (let i = 0; i < 5; i++) {
      const w = worker(); w.intake([{ ...update, update_id: update.update_id + i }]); await w.drain();
      expect(journal.view.recoveryPressure?.suspended).toBe(i === 4); now += 31000;
    }
    expect(notices).toBe(5);
    const w = worker(); w.intake([{ ...update, update_id: update.update_id + 5 }]); await w.drain();
    expect(replies).toBe(6); expect(notices).toBe(5);
    journal.close(); copyFileSync(join(dir, 'journal'), join(dir, 'successor'));
    journal = openPreviewJournal(join(dir, 'successor'), key, genesis); now += 31000;
    await worker().drain(); expect(replies).toBe(6); expect(journal.view.recoveryPressure?.suspended).toBe(true);
    configuration = null; await worker().drain(); expect(journal.view.recoveryPressure?.suspended).toBe(true);
    configuration = `sha256:${'1'.repeat(64)}`;
    const stranger = worker(); stranger.intake([{ ...update, update_id: update.update_id + 6,
      message: { ...update.message, from: { id: 1 }, text: '/resume-delivery' } }]);
    await stranger.drain(); expect(journal.view.recoveryPressure?.suspended).toBe(true);
    if (resume === 'rotation') configuration = `sha256:${'2'.repeat(64)}`;
    else { const owner = worker(); owner.intake([{ ...update, update_id: update.update_id + 7,
      message: { ...update.message, text: '/resume-delivery' } }]); }
    await worker().drain(); expect(journal.view.recoveryPressure?.suspended).toBe(false);
    expect(replies).toBeGreaterThan(6); expect(journal.view.recoveryPressure?.failures).toEqual([]);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it.each(['success', 'window'] as const)('escalation pressure does not trip after %s breaks the five-failure sequence', async reset => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-pressure-reset-')); let now = 1000, notices = 0;
  const journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  const worker = createJournalWorker(journal, { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => 'Answer',
    send: async input => input.target?.startsWith('delivery-notice:') && ++notices === 3 && reset === 'success'
      ? 91 : { kind: 'refused', reason: 'telegram 403' } });
  try {
    for (let i = 0; i < 5; i++) {
      if (reset === 'window' && i === 4) now += 3_600_001;
      worker.intake([{ ...update, update_id: update.update_id + i }]); await worker.drain(); now += 31000;
    }
    expect(journal.view.recoveryPressure?.suspended).toBe(false);
    expect(journal.view.recoveryPressure?.failures.length).toBe(reset === 'success' ? 2 : 1);
  } finally { journal.close(); rmSync(dir, { recursive: true, force: true }); }
});

it.each([['reply', 'lost'], ['reply', 'corrupt'], ['delivery-notice', 'lost'], ['delivery-notice', 'corrupt']] as const)(
  'single-machine physical acceptance survives %s %s receipt projection and handoff', async (kind, fault) => {
  const dir = mkdtempSync(join(tmpdir(), 'delivery-local-receipt-'));
  let now = 1000, deliveries = 0;
  const server = createServer((req, res) => {
    let body = ''; req.on('data', chunk => { body += String(chunk); }); req.on('end', () => {
      const input = JSON.parse(body) as { chat: string; expectedText: string };
      deliveries++; res.end(JSON.stringify({ ok: true, result: { message_id: 91,
        chat: { id: Number(input.chat) }, text: input.expectedText } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  let journal = openPreviewJournal(join(dir, 'journal'), key, genesis);
  let lose = true;
  const proxy = () => ({ ...journal, get view() { return journal.view; }, append: (row: Parameters<typeof journal.append>[0]) => {
    if (lose && (kind === 'reply' ? row.kind === 'sent' : row.kind === 'held-notice-sent' && row.deliveryUnknown)) {
      if (fault === 'corrupt' && (row.kind === 'sent' || row.kind === 'held-notice-sent')) {
        journal.append({ ...row, message: 0 }); return;
      }
      throw Error('injected target receipt storage failure');
    }
    journal.append(row);
  } });
  const worker = () => createJournalWorker(proxy(), { now: () => now, stopped: () => false, checkOutbound: () => {}, model: async () => fixture.candidate,
    send: async input => {
      if (!input.target?.startsWith(`${kind}:`)) return { kind: 'refused', reason: 'telegram 403' };
      const response = await fetch(endpoint, { method: 'POST', body: JSON.stringify(input) });
      return classifyTelegramSend({ kind: 'response', status: response.status, bytes: await response.text() }, input);
    } });
  try {
    const w = worker(); w.intake([update]); await w.drain().catch(() => {});
    const turn = journal.view.order[0]!, target = `${kind}:${turn.id}`;
    expect(journal.view.sendEvidence?.[target]?.message).toBe(91); expect(deliveries).toBe(1);
    expect(kind === 'reply' ? turn.sent : turn.deliveryNotice?.sent).toBeUndefined();
    expect(() => journal.append({ kind: 'send-acceptance', target, subject: `sha256:${'0'.repeat(64)}`, message: 91, at: now })).toThrow();
    expect(() => journal.append({ kind: 'send-acceptance', target, subject: journal.view.sendEvidence![target]!.provenance.contentHash, message: 92, at: now })).toThrow();
    journal.close(); copyFileSync(join(dir, 'journal'), join(dir, 'successor'));
    journal = openPreviewJournal(join(dir, 'successor'), key, genesis); lose = false; now += 31000;
    await worker().drain(); const recovered = journal.view.order[0]!;
    expect(kind === 'reply' ? recovered.sent : recovered.deliveryNotice?.sent).toBe(91);
    await worker().drain(); expect(deliveries).toBe(1);
  } finally { journal.close(); await new Promise<void>(resolve => server.close(() => resolve())); rmSync(dir, { recursive: true, force: true }); }
});
