import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { capabilityBriefing } from './briefing.js';
import { readSelfAccess, selfStateBrief, selfStateSource } from './self-state.js';
import { createJournalWorker, openPreviewJournal, closingNoticeText } from './journal-test-worker.js';
import { dueCredentialReminders, reminderSchedule, type CredentialRecord } from './secret-custody.js';
import { loopHealth } from './obligations.js';
import { publicCredentialRegister } from './reply-check.js';
import { credentialNotices } from './credential-reminders.js';

const end = 1794519600000;
const activation: CredentialRecord = { name: 'preview-activation', identity: 'activation', kind: 'activation',
  custody: 'activation-record', expirySource: 'activation-record', expiresAt: end, recordedAt: end - 1000,
  reminders: reminderSchedule(end), renewal: { standing: 'none', smallestHumanAction: 'approve a renewed activation record' } };
const token: CredentialRecord = { ...activation, name: 'login', identity: 'login', kind: 'jwt', custody: 'preview-vault',
  expirySource: 'jwt-exp', renewal: { standing: 'none', smallestHumanAction: 'supply replacement login' } };

it.each([end - 1000, end, end + 1000])('describes the activation reminder truthfully in the turn packet at %i', now => {
  const root = mkdtempSync(join(tmpdir(), 'activation-self-'));
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), new Uint8Array(32).fill(42), {
    kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321', grant: 'trial',
    configurationDigest: 'sha256:offline', expires: end, maxCalls: 10, maxReplies: 10, maxTurns: 10, maxBytes: 65536, cursor: 0 });
  try {
    const access = readSelfAccess({ credentials: () => [activation, token], held: () => [], missing: () => [],
      connectors: () => null, bot: 'agent', now });
    const brief = capabilityBriefing(path => readFileSync(path, 'utf8'), { providerAttempts: 10, expiresAt: end });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      sources: () => [{ id: 'capabilities', title: 'Capabilities', text: brief.text },
        selfStateSource(selfStateBrief(journal.view, { launches: [], unreadable: 0 }, now, 'UTC'), access)],
      model: async () => { throw Error('read only'); }, send: async () => { throw Error('read only'); }, checkOutbound: () => {} });
    const packet = worker.probe("who am I to you, and what can you actually do for me right now? Tell me anything you can't reach.");
    if ('reason' in packet) throw Error(packet.reason);
    const text = JSON.parse(packet.context).sources.map((s: { text: string }) => s.text).join('\n');
    expect(text).toContain('record-keeping reminder');
    expect(text).toContain('keeps working');
    expect(text).not.toContain('model attempts, ending');
    expect(access.credentials?.entries[0]?.expiry).toBe('record reminder; no stop or renewal needed to keep working');
    expect(access.credentials?.entries[1]?.expiry).toBe(now >= end ? 'expired' : 'not expired');
    journal.append({ kind: 'intake', id: 'telegram:12345678:update:1', update: 1, text: 'hello', raw: '{}', accepted: true, cursor: 2, at: now });
    expect(loopHealth(journal.view, now).inhibition).toBeNull();
    expect(loopHealth({ ...journal.view, stop: 'operator stopped' }, now).inhibition).toBe('operator stopped');
    expect(loopHealth({ ...journal.view, calls: 10 }, now).inhibition).toBe('model-call allowance used');
    expect(closingNoticeText(end)).toContain('the agent keeps reading and answering here');
    const due = dueCredentialReminders([activation, token], now);
    const facts = publicCredentialRegister([activation, token], [], now);
    expect(facts[0]?.expiry).toBe('record-keeping reminder; the agent keeps working');
    expect(facts[0]?.renewal.smallestHumanAction).toContain('No action needed to keep working');
    if (now >= end) expect(facts[1]?.expiry).toBe('has expired');
    expect(due[0]?.smallestHumanAction).toContain('No action needed to keep working');
    expect(credentialNotices(due, now)).toHaveLength(1);
    if (now >= end) expect(credentialNotices(due, now)[0]?.line).toContain('has expired');
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
});
