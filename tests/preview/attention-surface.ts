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

export function createAttentionSurface(journal: ReturnType<typeof openPreviewJournal>, host: {
  now(): number; machine: string; admitted(): boolean; replicated(): Promise<boolean>;
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
    const ack = queue.remoteAcks.enqueue({ itemId: id, targetMachineId: item.machineId ?? host.machine,
      status: normalized, operatorUid: journal.view.genesis.operator, authority, revision });
    // Record first, then wait for the installed durability demand. A failed peer
    // acknowledgement leaves the local intent visible and never reports delivery.
    if (!await host.replicated() || !admitted()) return { outcome: 'pending' as const };
    if (ack.lastOutcome === 'delivered') return { outcome: 'delivered' as const };
    queue.drain(a => admitted() && a.operatorUid === journal.view.genesis.operator);
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
    queue.drain(a => admitted() && a.operatorUid === journal.view.genesis.operator);
    await host.replicated();
  };
  const maintain = async () => {
    if (!admitted()) return;
    produceAttentionHealth(journal.view, queue, now());
    await drain();
  };
  return Object.freeze({ list, acknowledge, create, drain, maintain });
}
