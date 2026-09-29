import { describe, expect, it } from 'vitest';
import { consumeResult } from '../../src/types/internal.js';
import { decodeInfrastructureNotice, infrastructureNoticeDigest, renderInfrastructureNotice } from '../../src/effects/infrastructure-notice.js';
import { dispatchInfrastructureNotice } from '../../src/effects/infrastructure-notice-driver.js';
import type { NoticeDispatch, NoticeLedgerEntry, NoticeSendObservation } from '../../src/effects/infrastructure-notice-driver.js';
import type { InfrastructureNotice } from '../../src/effects/infrastructure-notice.js';

// Rules 52, 53, 88, 89: the Part Eight notice payload and the Part Ten confined driver, both sides of each decision.
const alerts = { grant: 'desk:alerts-2026-09-28', chat: '-1001234567890', topic: 42 };
const conversation = { chat: '7812716706', topic: null };
const notice = (over: Record<string, unknown> = {}) => ({ type: 'InfrastructureNotice', schemaVersion: 1, episode: 'host-watch:ep-1',
  purpose: 'action-needed', speaker: 'infrastructure:host-watch', destination: { kind: 'alerts', ...alerts },
  selfHeal: { subject: 'journal runner', attempts: 3, failures: [
    { at: 1_790_000_000_000, code: 1, signal: null, runReason: 'error (details suppressed)', hung: false },
    { at: 1_790_000_001_000, code: null, signal: 'SIGKILL', runReason: 'no progress beat for 180s', hung: true },
    { at: 1_790_000_002_000, code: 1, signal: null, runReason: null, hung: false }] }, ...over });
type Decoded = { ok: true; value: InfrastructureNotice } | { ok: false; detail: string };
const decoded = (input: unknown): Decoded => consumeResult<InfrastructureNotice, Decoded>(decodeInfrastructureNotice(input), {
  Success: value => ({ ok: true, value }), Refused: refused => ({ ok: false, detail: refused.detail }) });
type Outcome = ({ ok: true } & NoticeDispatch) | { ok: false; detail: string };
const outcome = (result: ReturnType<typeof dispatchInfrastructureNotice>): Outcome => consumeResult<NoticeDispatch, Outcome>(result, {
  Success: value => ({ ok: true, ...value }), Refused: refused => ({ ok: false, detail: refused.detail }) });
const valid = (): InfrastructureNotice => { const value = decoded(notice()); if (!value.ok) throw Error(value.detail); return value.value; };
function ports(answer: NoticeSendObservation = { kind: 'response', status: 200, bytes: '{"ok":true,"result":{"message_id":77}}' }) {
  const ledger = new Map<string, NoticeLedgerEntry>(); const sent: Record<string, unknown>[] = [];
  let failWrite = false;
  return { ledger, sent, failWrites: () => { failWrite = true; }, ports: {
    readLedger: (episode: string) => ledger.get(episode) ?? null,
    writeLedger: (entry: NoticeLedgerEntry) => { if (failWrite) throw Error('disk'); ledger.set(entry.episode, entry); },
    send: (body: Record<string, unknown>) => { sent.push(body); return answer; },
    now: () => 5, instant: (at: number) => `t${at}` } };
}

describe('infrastructure-notice payload', () => {
  it('accepts the declared record and refuses each missing reference, undeclared field or wrong route/speaker', () => {
    expect(decoded(notice()).ok).toBe(true);
    const selfHeal = notice().selfHeal;
    for (const bad of [
      notice({ extra: 1 }),
      notice({ purpose: 'ordinary-reply' }),
      notice({ speaker: 'agent:echo' }),
      notice({ speaker: 'operator' }),
      notice({ destination: { kind: 'conversation', ...alerts } }),
      notice({ selfHeal: { ...selfHeal, failures: [] } }),
      notice({ selfHeal: { subject: 'journal runner', attempts: 3 } }),
      notice({ selfHeal: { ...selfHeal, attempts: 2 } }),
      notice({ episode: 'has spaces' }),
    ]) expect(decoded(bad).ok).toBe(false);
  });

  it('renders a fixed infrastructure text citing every failed attempt; the digest binds the evidence', () => {
    const value = decoded(notice());
    if (!value.ok) throw Error(value.detail);
    const text = renderInfrastructureNotice(value.value, at => `t${at}`);
    expect(text).toContain('Infrastructure notice (host-watch, not the agent)');
    expect(text).toContain('did not recover after 3 restart attempts');
    expect(text).toContain('1. t1790000000000: exited with code 1 (error (details suppressed)).');
    expect(text).toContain('2. t1790000001000: stopped responding and was restarted (no progress beat for 180s).');
    const other = decoded(notice({ episode: 'host-watch:ep-2' }));
    if (!other.ok) throw Error(other.detail);
    expect(infrastructureNoticeDigest(value.value)).not.toBe(infrastructureNoticeDigest(other.value));
  });
});

describe('confined notice driver', () => {
  it('sends once to the alerts topic, records the dispatch first, and never sends again for the episode', () => {
    const p = ports();
    let recordedBeforeSend = false;
    const send = p.ports.send;
    p.ports.send = body => { recordedBeforeSend = p.ledger.get('host-watch:ep-1')?.state === 'dispatching'; return send(body); };
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, p.ports))).toEqual({ ok: true, state: 'delivered', duplicate: false, messageId: 77 });
    expect(recordedBeforeSend).toBe(true);
    expect(p.sent).toHaveLength(1);
    expect(p.sent[0]).toMatchObject({ chat_id: alerts.chat, message_thread_id: 42 });
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, p.ports))).toEqual({ ok: true, state: 'delivered', duplicate: true, messageId: 77 });
    expect(p.sent).toHaveLength(1);
  });

  it('an unknown outcome stays uncertain and is never re-sent; a definite Telegram rejection is refused', () => {
    const lost = ports({ kind: 'uncertain', stage: 'fetch-timeout' });
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, lost.ports))).toMatchObject({ state: 'uncertain' });
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, lost.ports))).toMatchObject({ state: 'uncertain', duplicate: true });
    expect(lost.sent).toHaveLength(1);
    // A dispatch recorded by a process that died before settling is uncertain too, never a fresh attempt.
    const crashed = ports(); crashed.ledger.set('host-watch:ep-1', { episode: 'host-watch:ep-1',
      digest: infrastructureNoticeDigest(valid()), state: 'dispatching', at: 1 });
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, crashed.ports))).toMatchObject({ state: 'uncertain', duplicate: true });
    expect(crashed.sent).toHaveLength(0);
    const rejected = ports({ kind: 'response', status: 400, bytes: '{"ok":false,"description":"chat not found"}' });
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, rejected.ports))).toMatchObject({ state: 'refused' });
  });

  it('refuses before any send: the conversation route, a destination other than the configured alerts, an unrecordable dispatch', () => {
    const p = ports();
    const intoConversation = { ...alerts, chat: conversation.chat, topic: null };
    expect(outcome(dispatchInfrastructureNotice(notice({ destination: { kind: 'alerts', ...intoConversation } }), intoConversation, conversation, p.ports)))
      .toMatchObject({ ok: false, detail: 'the alerts destination is the conversation route' });
    expect(outcome(dispatchInfrastructureNotice(notice(), { ...alerts, topic: 7 }, conversation, p.ports)))
      .toMatchObject({ ok: false, detail: 'notice destination is not the configured alerts destination' });
    expect(outcome(dispatchInfrastructureNotice(notice({ selfHeal: undefined }), alerts, conversation, p.ports)).ok).toBe(false);
    p.failWrites();
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, conversation, p.ports)))
      .toMatchObject({ ok: false, detail: 'notice dispatch could not be recorded; nothing was sent' });
    expect(p.sent).toHaveLength(0);
    // The positive neighbour: a group alerts topic in the conversation's own chat id space is still distinct.
    const q = ports();
    expect(outcome(dispatchInfrastructureNotice(notice(), alerts, { chat: alerts.chat, topic: 1 }, q.ports))).toMatchObject({ state: 'delivered' });
  });
});
