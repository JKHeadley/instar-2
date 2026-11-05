/** Installed operator consumer for row 88, composed by journal-agent.mjs.
 * The HTTP adapter calls this only after its existing PIN session check. The
 * receipt is the hashed session/request identity, never the PIN or cookie.
 * Acknowledge changes queue state only; it grants no approval or execution.
 */
import type { openPreviewJournal } from './journal.js';
import { AttentionQueue } from './attention-queue.js';
import { normalizeAttentionStatus } from './attention-vocabulary.js';
import { redact } from '../../src/recall/redact.js';
import { produceAttentionHealth } from './attention-health.js';

export interface TrackingSubject {
  installation: string; itemId: string; targetMachineId: string; revision: number; status: string;
}
export interface AttentionTrackingPort {
  issue(subject: TrackingSubject, installation: { artifact: string; generation: string; expiresAt: number }): unknown;
  pending(): string[];
  verify(proof: string): { subject: TrackingSubject; artifact: string; generation: string;
    operator: string; decision: string; authority: string; act: null };
  complete(proof: string): void;
  link(challenge: unknown): string;
}

export function createAttentionSurface(journal: ReturnType<typeof openPreviewJournal>, host: {
  now(): number; machine: string; admitted(): boolean; replicated(): Promise<boolean>;
  tracking?: AttentionTrackingPort;
}) {
  const now = () => Math.max(host.now(), journal.view.clockFloor);
  const admitted = () => host.admitted() && journal.view.stop === null && now() < journal.view.expires;
  const queue = new AttentionQueue({ state: () => journal.view.attention,
    append: row => { if (!admitted()) throw Error('attention: owner, stop or grant refused'); journal.append(row); } }, now);
  const receipt = (authority: string) => {
    if (!/^dashboard:[a-f0-9]{64}$/u.test(authority)) throw Error('attention: verified surface receipt required');
    if (!admitted()) throw Error('attention: owner, stop or grant refused');
  };
  const list = () => ({ items: queue.getAttentionItems().map(i => ({ ...i, title: redact(i.title).text,
    summary: redact(i.summary).text, description: undefined })),
    acknowledgements: (journal.view.attention?.acknowledgements ?? []).map(a => ({ itemId: a.itemId, status: a.status,
      outcome: a.lastOutcome, attempts: a.attempts })), capacity: journal.view.attention?.conditionCapacity ?? null, asOf: now() });
  const acknowledge = async (id: string, status: unknown, revision: number, authority: string) => {
    receipt(authority);
    const normalized = normalizeAttentionStatus(status), item = queue.getAttentionItem(id);
    if (!item || !normalized || revision !== item.revision) throw Error('attention: item missing, status invalid or item changed; reload');
    if (host.tracking) {
      const challenge = host.tracking.issue({ installation: journal.view.genesis.configurationDigest,
        itemId: id, targetMachineId: item.machineId ?? host.machine, revision, status: normalized },
      { artifact: journal.view.genesis.configurationDigest, generation: journal.view.genesis.configurationDigest,
        expiresAt: journal.view.expires });
      return { outcome: 'confirmation-required' as const, url: host.tracking.link(challenge) };
    }
    const ack = queue.remoteAcks.enqueue({ itemId: id, targetMachineId: item.machineId ?? host.machine,
      status: normalized, operatorUid: journal.view.genesis.operator, authority, revision });
    // Record first, then wait for the installed durability demand. A failed peer
    // acknowledgement leaves the local intent visible and never reports delivery.
    if (!await host.replicated() || !admitted()) return { outcome: 'pending' as const };
    if (ack.lastOutcome === 'delivered') return { outcome: 'delivered' as const };
    queue.drain(a => admitted() && a.operatorUid === journal.view.genesis.operator, a => a.authority.startsWith('dashboard:'));
    if (!await host.replicated() || !admitted()) return { outcome: 'pending' as const };
    const settled = journal.view.attention?.acknowledgements.find(a => a.itemId === id && a.targetMachineId === ack.targetMachineId);
    return { outcome: settled?.authority === authority ? settled.lastOutcome : 'stale-superseded' };
  };
  const create = async (title: string, authority: string) => {
    receipt(authority);
    if (typeof title !== 'string' || !title.trim() || title.length > 200) throw Error('attention: title required, at most 200 characters');
    const item = queue.createAttentionItem({ id: `operator-${authority.slice(10)}`, title: redact(title.trim()).text,
      summary: '', category: 'operator', priority: 'NORMAL', machineId: host.machine });
    const replicated = await host.replicated();
    return { id: item.id, outcome: replicated && admitted() ? 'saved' : 'pending' };
  };
  const drain = async () => {
    if (!admitted() || !queue.remoteAcks.size || !await host.replicated() || !admitted()) return;
    queue.drain(a => admitted() && a.operatorUid === journal.view.genesis.operator, a => a.authority.startsWith('dashboard:'));
    await host.replicated();
  };
  let trackingCursor = 0;
  const drainTracking = async () => {
    const tracking = host.tracking;
    if (!tracking || !admitted()) return;
    // Existing independent custody is the intake store until the legitimate owner
    // returns. Verification consumes nothing until this journal's durable result.
    const pending = tracking.pending();
    const start = pending.length ? trackingCursor % pending.length : 0;
    const batch = [...pending.slice(start), ...pending.slice(0, start)].slice(0, 64);
    trackingCursor = start + batch.length;
    for (const proof of batch) {
      if (!admitted()) return;
      let verified: ReturnType<AttentionTrackingPort['verify']>;
      try { verified = tracking.verify(proof); } catch { continue; }
      const s = verified.subject;
      if (verified.act !== null || verified.operator !== `telegram:${journal.view.genesis.operator}`
        || s.installation !== journal.view.genesis.configurationDigest
        || verified.artifact !== journal.view.genesis.configurationDigest
        || verified.generation !== journal.view.genesis.configurationDigest) continue;
      const item = queue.getAttentionItem(s.itemId), status = normalizeAttentionStatus(s.status);
      if (!item || s.targetMachineId !== (item.machineId ?? host.machine) || !status) continue;
      const prior = journal.view.attention?.acknowledgements.find(a => a.authority === verified.authority);
      if (prior?.lastOutcome === 'delivered') {
        if (await host.replicated() && admitted()) tracking.complete(proof);
        continue;
      }
      if (verified.decision !== 'approve' || item.revision !== s.revision) continue;
      queue.remoteAcks.enqueue({ itemId: s.itemId, targetMachineId: s.targetMachineId, status,
        operatorUid: journal.view.genesis.operator, authority: verified.authority, revision: s.revision });
      if (!await host.replicated() || !admitted()) return;
      try { tracking.verify(proof); } catch { continue; }
      queue.drain(a => admitted() && a.operatorUid === journal.view.genesis.operator, a => a.authority === verified.authority);
      if (await host.replicated() && admitted()
        && journal.view.attention?.acknowledgements.some(a => a.authority === verified.authority && a.lastOutcome === 'delivered')) tracking.complete(proof);
    }
  };
  const maintain = async () => {
    if (!admitted()) return;
    produceAttentionHealth(journal.view, queue, now());
    await drainTracking();
    await drain();
  };
  return Object.freeze({ list, acknowledge, create, drain, drainTracking, maintain });
}
