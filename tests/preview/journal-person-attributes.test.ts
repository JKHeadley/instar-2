import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal-test-worker.js';

const key = new Uint8Array(32).fill(29);
const day = 86_400;
const start = Math.floor(Date.UTC(2026, 8, 1) / 1000);
const genesis = { kind: 'genesis' as const, bot: '12345678', chat: '7654321', operator: '7654321',
  grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
  maxCalls: 400, maxReplies: 200, maxTurns: 120, maxBytes: 10000, cursor: 0 };
const changes: Record<string, { attribute: 'job' | 'city' | 'partner' | 'pet'; value: string; status: 'current' | 'ended' }> = {
  'Sam Rivera now works at Acme.': { attribute: 'job', value: 'Acme', status: 'current' },
  'Sam Rivera lives in Boston.': { attribute: 'city', value: 'Boston', status: 'current' },
  'Sam Rivera moved from Boston to Seattle.': { attribute: 'city', value: 'Seattle', status: 'current' },
  'Sam Rivera left Acme and now works at Beta.': { attribute: 'job', value: 'Beta', status: 'current' },
  'Sam Rivera now works at Gamma.': { attribute: 'job', value: 'Gamma', status: 'current' },
  "Sam Rivera's partner is Maya.": { attribute: 'partner', value: 'Maya', status: 'current' },
  'Sam Rivera and Maya broke up.': { attribute: 'partner', value: 'Maya', status: 'ended' },
  'Sam Rivera adopted a cat named Luna.': { attribute: 'pet', value: 'Luna', status: 'current' },
  "Sam Rivera's cat Luna died.": { attribute: 'pet', value: 'Luna', status: 'ended' },
};
const proposal = (text: string) => changes[text] ? { name: 'Sam Rivera', ...changes[text], quote: text } : null;
const update = (id: number, text: string, sender = 7654321) => ({ update_id: id,
  message: { chat: { id: 7654321, type: 'private' }, from: { id: sender }, text, date: start + id * day } });

function world(root: string, onCompact?: () => void) {
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis,
    stage => { if (stage === 'compact:after-rename') onCompact?.(); }, false, 32768);
  const packets = new Map<string, Record<string, unknown>>();
  const worker = createJournalWorker(journal, { now: () => (start + 75 * day) * 1000, stopped: () => false,
    model: async input => {
      const packet = JSON.parse(input.context) as Record<string, unknown>;
      if (input.id.startsWith('summary:')) {
        const history = packet.history as { user: string }[];
        return JSON.stringify({ summary: 'Earlier turns covered Sam Rivera and ordinary plans.',
          people: history.filter(turn => turn.user.includes('Sam Rivera')).map(turn => ({ name: 'Sam Rivera', quote: turn.user })),
          personAttributes: history.map(turn => proposal(turn.user)).filter(Boolean), memory: [], commitments: [], closed: [] });
      }
      packets.set(input.question, packet);
      if (input.question.includes('current job and city')) {
        const items = packet.personAttributes as { attribute: string; value: string; status: string; date: string }[];
        const current = (attribute: string) => items.find(item => item.attribute === attribute && item.status === 'current');
        const old = items.filter(item => item.status === 'historical').map(item => `${item.value} (${item.date})`).join(', ');
        return JSON.stringify({ reply: { answer: `Current: ${current('job')?.value} (${current('job')?.date}), ${current('city')?.value} (${current('city')?.date}). Earlier: ${old}.` },
          memory: [], dated: [], personAttributes: [] });
      }
      return JSON.stringify({ reply: { answer: 'Recorded the dated report.' }, memory: [], dated: [],
        personAttributes: proposal(input.question) ? [proposal(input.question)] : [] });
    }, send: async () => 1, checkOutbound: () => {} });
  const say = async (id: number, text: string, sender?: number) => {
    worker.intake([update(id, text, sender)]); await worker.drain(); await worker.summarizeIfNeeded();
  };
  return { journal, worker, packets, say };
}

it('keeps two months of job, city, partner and pet changes dated across summaries and two restarts', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-attributes-')));
  try {
    let compactions = 0;
    let w = world(root, () => { compactions++; });
    const messages: Record<number, string> = {
      1: 'Sam Rivera now works at Acme.', 2: 'Sam Rivera lives in Boston.',
      12: "Sam Rivera's partner is Maya.", 20: 'Sam Rivera moved from Boston to Seattle.',
      28: 'Sam Rivera adopted a cat named Luna.', 38: 'Sam Rivera left Acme and now works at Beta.',
      48: 'Sam Rivera and Maya broke up.', 60: "Sam Rivera's cat Luna died.",
    };
    for (let id = 1; id <= 65; id++) {
      await w.say(id, messages[id] ?? `Ordinary day ${id}: errands and plans ${'x'.repeat(55)}`);
      if (id === 35) { w.journal.close(); w = world(root, () => { compactions++; }); }
    }
    expect(w.journal.view.summaries.length).toBeGreaterThan(1);
    expect(w.journal.view.personAttributes.length).toBeGreaterThanOrEqual(8);
    expect(compactions).toBeGreaterThan(0);
    w.journal.close(); w = world(root, () => { compactions++; });
    const probe = w.worker.probe("What is Sam Rivera's current job and city, and what is their history?");
    if ('reason' in probe) throw Error(probe.reason);
    const packet = JSON.parse(probe.context) as { personAttributes: { attribute: string; value: string;
      status: string; date: string; source: string }[]; historyMode: string; capability: string };
    expect(packet.historyMode).toBe('summary-plus-recent');
    const attribute = (kind: string) => packet.personAttributes.filter(item => item.attribute === kind);
    expect(attribute('job').map(item => [item.value, item.status])).toEqual([['Acme', 'historical'], ['Beta', 'current']]);
    expect(attribute('city').map(item => [item.value, item.status])).toEqual([['Boston', 'historical'], ['Seattle', 'current']]);
    expect(attribute('partner').map(item => [item.value, item.status])).toEqual([['Maya', 'historical'], ['Maya', 'ended']]);
    expect(attribute('pet').map(item => [item.value, item.status])).toEqual([['Luna', 'historical'], ['Luna', 'ended']]);
    expect(attribute('job')[1]).toMatchObject({ date: new Date((start + 38 * day) * 1000).toISOString().slice(0, 16) + 'Z',
      source: 'telegram:12345678:update:38' });
    expect(packet.capability).toContain('historical and ended values must never be stated as current');
    expect(packet.personAttributes.filter(item => item.status === 'current').map(item => item.value)).toEqual(['Seattle', 'Beta']);
    const question = "What is Sam Rivera's current job and city, and what is their history?";
    await w.say(66, question);
    const reply = w.journal.view.order.find(turn => turn.update === 66)?.intent;
    expect(reply).toContain('Current: Beta (2026-10-09T00:00Z), Seattle (2026-09-21T00:00Z).');
    expect(reply).toContain('Earlier: Acme (2026-09-02T00:00Z)');
    expect(reply).not.toContain('Current: Acme');
    await w.say(67, 'Sam Rivera now works at Gamma.');
    const fresh = w.worker.probe('What is Sam Rivera\'s current job?');
    if ('reason' in fresh) throw Error(fresh.reason);
    const freshJobs = (JSON.parse(fresh.context) as { personAttributes: { attribute: string; value: string; status: string }[] })
      .personAttributes.filter(item => item.attribute === 'job');
    // The older value is optional context: it may stay when the packet has room (int12 packets
    // differ in size), but only the newest value is ever current.
    expect(freshJobs.map(item => [item.value, item.status]).slice(-2)).toEqual([['Beta', 'historical'], ['Gamma', 'current']]);
    expect(freshJobs.filter(item => item.status === 'current').map(item => item.value)).toEqual(['Gamma']);
    const full = w.worker.probe("List Sam Rivera's job history.");
    if ('reason' in full) throw Error(full.reason);
    const history = (JSON.parse(full.context) as { personAttributes: { attribute: string; value: string; status: string }[] })
      .personAttributes.filter(item => item.attribute === 'job');
    expect(history.map(item => [item.value, item.status])).toEqual([
      ['Acme', 'historical'], ['Beta', 'historical'], ['Gamma', 'current']]);
    w.journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 60000); // Two months of turns with two restarts took 8.6 s alone, so the 10 s default fails under suite load.

it('rejects invented and unverified attribute proposals while keeping intake durable', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-attributes-')));
  try {
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => (start + 75 * day) * 1000, stopped: () => false,
      model: async input => JSON.stringify({ reply: { answer: 'I heard that.' }, memory: [], dated: [],
        personAttributes: [{ name: 'Sam Rivera', attribute: 'job', value: 'InventedCorp', status: 'current',
          quote: input.question }] }), send: async () => 1, checkOutbound: () => {} });
    worker.intake([update(1, 'Sam Rivera now works at Acme.')]); await worker.drain();
    worker.intake([update(2, 'Sam Rivera now works at Acme.', 999)]); await worker.drain();
    expect(journal.view.personAttributes).toEqual([]);
    expect(journal.view.order[0]?.text).toBe('Sam Rivera now works at Acme.');
    expect(journal.view.order[0]?.memoryPending).toBe(true);
    expect(journal.view.order.find(turn => turn.update === 2)?.accepted).toBe(false);
    journal.close();
    const reopened = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    expect(reopened.view.personAttributes).toEqual([]);
    expect(reopened.view.order[0]?.text).toBe('Sam Rivera now works at Acme.');
    reopened.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

it('withholds a corrected attribute, retains the replacement, then forgets it across replay', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-attributes-')));
  try {
    let journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const worker = createJournalWorker(journal, { now: () => (start + 75 * day) * 1000, stopped: () => false,
      model: async input => {
        if (input.id.startsWith('summary:')) return JSON.stringify({ summary: 'Sam Rivera had a job update.', people: [],
          personAttributes: [], memory: [], commitments: [], closed: [] });
        const packet = JSON.parse(input.context) as { memoryCandidates?: { id: string }[] };
        if (input.question === 'Sam Rivera now works at Acme.')
          return JSON.stringify({ reply: { answer: 'Recorded.' }, memory: [], dated: [], personAttributes: [proposal(input.question)] });
        if (input.question === 'Correction: Sam Rivera works at Beta, not Acme.')
          return JSON.stringify({ reply: { answer: 'Corrected.' }, dated: [], personAttributes: [{ name: 'Sam Rivera',
            attribute: 'job', value: 'Beta', status: 'current', quote: 'Sam Rivera works at Beta' }],
          memory: [{ mode: 'correct', source: packet.memoryCandidates?.find(item => item.id.endsWith(':1'))?.id,
            quote: 'Sam Rivera now works at Acme.', replacement: 'Sam Rivera works at Beta' }] });
        return JSON.stringify({ reply: { answer: 'Forgotten.' }, dated: [], personAttributes: [],
          memory: [{ mode: 'forget', source: packet.memoryCandidates?.find(item => item.id.endsWith(':2'))?.id,
            quote: 'Sam Rivera works at Beta' }] });
      }, send: async () => 1, checkOutbound: () => {} });
    const say = async (id: number, text: string) => { worker.intake([update(id, text)]); await worker.drain(); };
    await say(1, 'Sam Rivera now works at Acme.');
    expect(journal.view.personAttributes).toHaveLength(1);
    await say(2, 'Correction: Sam Rivera works at Beta, not Acme.');
    expect(journal.view.order.find(turn => turn.update === 2)?.memoryPending).toBeFalsy();
    const corrected = worker.probe("What is Sam Rivera's job history?");
    if ('reason' in corrected) throw Error(corrected.reason);
    expect((JSON.parse(corrected.context) as { personAttributes: { value: string; status: string }[] }).personAttributes)
      .toMatchObject([{ value: 'Beta', status: 'current' }]);
    await say(3, 'Please remove Sam Rivera works at Beta from memory.');
    expect(journal.view.order.find(turn => turn.update === 3)?.memoryPending).toBeFalsy();
    expect(journal.view.order.find(turn => turn.update === 3)?.answer).toBe('Forgotten.');
    journal.close(); journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    expect(journal.view.personAttributes).toHaveLength(2);
    expect(journal.view.memory).toHaveLength(2);
    const restarted = createJournalWorker(journal, { now: () => (start + 75 * day) * 1000, stopped: () => false,
      model: async () => 'Noted.', send: async () => 1, checkOutbound: () => {} });
    const after = restarted.probe("What is Sam Rivera's current job?");
    if ('reason' in after) throw Error(after.reason);
    expect((JSON.parse(after.context) as { personAttributes?: unknown[] }).personAttributes).toBeUndefined();
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
