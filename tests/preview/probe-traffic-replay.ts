/** Offline probe-traffic replay over the real encrypted journal. The desk's build
 * switches and renewal canaries send "<Build|Renewal|Canary> check <sha>: my test
 * marker is Juniper..." through the operator's own Telegram account, so the live
 * journal records them as ordinary verified operator turns. This replays a week of
 * ordinary operator conversation (two conversations) interleaved with eight such
 * probes (one of which got the canary's model-failure answer), with rolling summaries
 * and restarts, then asks later ordinary questions read-only and reports, per memory
 * surface, how often probe content appears. Controls: the operator genuinely talks
 * about a niece named Juniper, juniper shrubs and a whiteboard marker, and says they
 * prefer short replies; those must keep surfacing. The summarizer stub is faithful: it
 * restates every operator message it is shown, as a real summary would. No network,
 * model, Telegram send or live journal is touched. */
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createJournalWorker, openPreviewJournal } from './journal.js';
import { REPLY_RULES } from './reply-check.js';
import { SUMMARY_QUESTION } from './summary-check.js';

export const PROBE_ZONE = 'America/Los_Angeles';
const at = (value: string) => Date.parse(value);

/** Probe content as it can appear anywhere: the desk tag, the planted clause, the canary's reply. */
export const PROBE_CONTENT = /\b(?:Build|Renewal|Canary) check [0-9a-f]{7,40}\b|test marker|marker is Juniper/giu;
export const probeHits = (text: string) => text.match(PROBE_CONTENT)?.length ?? 0;

export interface PlannedTurn { day: string; time: string; text: string; thread?: number;
  kind: 'probe' | 'probe-failed' | 'control' | 'ordinary' }
const probe = (sha: string, word: 'Build' | 'Renewal' | 'Canary', extra = '') =>
  `${word} check ${sha}: my test marker is Juniper${extra}. What is my test marker?`;
/** The plan. Days are UTC dates of the send times; all are daytime in the operator zone. */
export const PLAN: readonly PlannedTurn[] = [
  { day: '2026-09-21', time: '16:00', kind: 'ordinary', text: 'My sister Maya moves to Portland next month.' },
  { day: '2026-09-22', time: '16:10', kind: 'control', text: 'I bought a new whiteboard marker set for the office.' },
  { day: '2026-09-23', time: '16:20', kind: 'control', text: 'We planted two juniper shrubs along the back fence.', thread: 7 },
  { day: '2026-09-24', time: '17:00', kind: 'probe', text: probe('58a2f4b4', 'Build') },
  { day: '2026-09-24', time: '17:30', kind: 'probe-failed', text: probe('618338ea', 'Canary', ' and I prefer short replies') },
  { day: '2026-09-25', time: '16:30', kind: 'control', text: 'My niece Juniper visits on Saturday October 3.' },
  { day: '2026-09-26', time: '16:40', kind: 'control', text: 'I prefer short replies.' },
  { day: '2026-09-26', time: '18:00', kind: 'ordinary', text: 'The gutter cleaning is booked for Friday October 2.', thread: 7 },
  { day: '2026-09-27', time: '13:30', kind: 'probe', text: probe('7d824d64', 'Renewal') },
  { day: '2026-09-27', time: '14:00', kind: 'probe', text: probe('7d824d64', 'Canary', ' and I prefer short replies') },
  { day: '2026-09-27', time: '15:00', kind: 'ordinary', text: 'The dentist moved to Thursday October 1 at 9am.' },
  { day: '2026-09-27', time: '16:30', kind: 'probe', text: probe('3695117d', 'Build') },
  { day: '2026-09-27', time: '17:13', kind: 'probe', text: probe('3695117d', 'Build') },
  // After the last summary: these stay in recent history.
  { day: '2026-09-27', time: '18:00', kind: 'probe', text: probe('3695117d', 'Renewal') },
  { day: '2026-09-27', time: '18:20', kind: 'ordinary', text: 'Remind me that the car registration is due October 9.' },
  { day: '2026-09-27', time: '18:40', kind: 'probe', text: probe('a1ecddb7', 'Build') },
];

export interface Question { id: string; surface: string; text: string; control?: RegExp }
export const QUESTIONS: readonly Question[] = [
  { id: 'ordinary', surface: 'answer packet', text: 'Anything I should keep in mind for the house this week?' },
  { id: 'week', surface: 'answer packet (a week question)', text: 'What did I tell you this week?', control: /niece Juniper/u },
  { id: 'inventory', surface: 'memory inventory', text: 'What do you remember about me?', control: /whiteboard marker/u },
  { id: 'repeat', surface: 'repeat-question awareness', text: 'Have I asked you the same question more than once lately?' },
  { id: 'open', surface: 'open questions', text: 'Is there anything I asked that you still owe me an answer on?' },
  { id: 'juniper', surface: 'control: niece', text: 'When is Juniper visiting?', control: /niece Juniper/u },
  { id: 'shrubs', surface: 'control: shrubs', text: 'How many juniper shrubs did we plant?', control: /juniper shrubs/u },
  { id: 'marker', surface: 'control: marker', text: 'What kind of marker did I buy for the office?', control: /whiteboard marker/u },
];

export interface SurfaceRow { question: string; surface: string; probeHits: number; blocks: Record<string, number>;
  control: boolean | null; inventoryTotal?: number; openQuestions?: number }
export interface ProbeReplayResult { rows: SurfaceRow[]; summaries: { count: number; withProbe: number; probeHits: number; controlJuniper: boolean };
  people: { total: number; fromProbe: number; control: boolean }; preferences: { active: number; fromProbe: number; control: boolean };
  commitments: { total: number; fromProbe: number }; journal: { turns: number; probeTurns: number; auditable: boolean };
  replayStable: boolean; sends: number; restarts: number }

const BLOCKS = ['history', 'recalled', 'summary', 'inventory', 'memorySearch', 'openQuestions', 'commitments',
  'people', 'preferences', 'contradictions', 'memory'] as const;

function measure(question: Question, context: string): SurfaceRow {
  const packet = JSON.parse(context) as Record<string, unknown>;
  const blocks: Record<string, number> = {};
  for (const block of BLOCKS) if (packet[block] !== undefined) {
    const hits = probeHits(JSON.stringify(packet[block]));
    if (hits) blocks[block] = hits;
  }
  const inventory = packet.inventory as { total?: number } | undefined;
  return { question: question.id, surface: question.surface, probeHits: probeHits(context), blocks,
    control: question.control ? question.control.test(context) : null,
    ...(inventory?.total === undefined ? {} : { inventoryTotal: inventory.total }),
    ...(Array.isArray(packet.openQuestions) ? { openQuestions: packet.openQuestions.length } : {}) };
}

export async function runProbeTrafficReplay(): Promise<ProbeReplayResult & { packets: Record<string, string> }> {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-probe-traffic-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(67);
  let clock = at('2026-09-21T15:00:00Z'), sends = 0, update = 0, restarts = 0;
  const failing = new Set(PLAN.filter(item => item.kind === 'probe-failed').map(item => item.text));
  const ports = { now: () => clock, stopped: () => false, timeZone: PROBE_ZONE,
    model: async (input: { id: string; question: string; context: string }) => {
      if (input.id.startsWith('summary:')) {
        // A faithful rolling summary: carry the earlier summary forward and restate every
        // non-routine operator message shown in history, the way a real summary keeps facts.
        const packet = JSON.parse(input.context) as { summary?: { text: string }; history?: { user?: string }[];
          unansweredCandidates?: unknown[]; memoryRequest?: { id: string; message: string } };
        const said = (packet.history ?? []).map(item => item.user ?? '').filter(text => text && !text.startsWith('Routine note'))
          .map(text => `The operator said: ${text}`);
        const people = (packet.history ?? []).flatMap(item => [...(item.user ?? '').matchAll(/\b(?:niece|sister) ([A-Z][a-z]+)/gu)]
          .map(match => ({ name: match[1]!, quote: item.user! })));
        const request = packet.memoryRequest;
        const memory = request && /^\s*I prefer\b/iu.test(request.message)
          ? [{ mode: 'prefer', source: request.id, quote: request.message.trim() }] : [];
        return JSON.stringify({ summary: [packet.summary?.text ?? 'The operator shared notes.', ...said].join(' '),
          people, commitments: [], closed: [], questions: [], memory });
      }
      if (failing.has(input.question)) return '';
      // An eager model: it records any "I prefer ..." clause in the current message as a reply-style preference.
      const prefer = /I prefer short replies/u.exec(input.question);
      const memory = prefer ? [{ mode: 'prefer', source: input.id, quote: prefer[0] }] : [];
      if (/test marker/iu.test(input.question))
        return JSON.stringify({ reply: { answer: 'Your marker is Juniper.' }, memory, dated: [] });
      return JSON.stringify({ reply: { answer: 'Noted.' }, memory, dated: [] });
    },
    checkOutbound: () => {}, send: async () => ++sends,
    summaryCheck: async () => ({ model: 'jev-1.13.0', answers: { lost_memory: { type: 'noul', noul: 0.01 } } }),
    replyCheck: { elapsedMs: () => 100, jev: async () => ({ value: { model: 'jev-1.13.0',
      answers: Object.fromEntries([...Object.keys(REPLY_RULES), ...Object.keys(SUMMARY_QUESTION)]
        .map(id => [id, { type: 'noul', noul: 0.01 }])) }, latencyMs: 1 }),
    escalate: async () => { throw Error('unexpected escalation'); } } };
  const message = (text: string, written: number, thread?: number) => ({ update_id: ++update,
    message: { chat: { id: 7654321, type: 'private' }, from: { id: 7654321 }, text, date: Math.floor(written / 1000),
      ...(thread === undefined ? {} : { message_thread_id: thread }) } });
  // Routine notes keep complete history above the packet bound, so summaries cover older turns.
  const bulk = (day: string, index: number) => message(`Routine note ${day}-${index}. ${'routine '.repeat(85)}`,
    at(`${day}T${String(19 + index).padStart(2, '0')}:30:00Z`));
  let journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
    grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: at('2026-10-05T00:00:00Z'),
    maxCalls: 400, maxReplies: 400, maxTurns: 80, maxBytes: 12000, cursor: 0 });
  const reopen = () => { journal.close(); journal = openPreviewJournal(path, key); restarts++; return createJournalWorker(journal, ports); };
  try {
    let worker = createJournalWorker(journal, ports);
    const deliver = async (batch: ReturnType<typeof message>[], summarize = true) => {
      clock = batch.at(-1)!.message.date * 1000 + 5_000;
      worker.intake(batch); await worker.drain(); if (summarize) await worker.summarizeIfNeeded(true);
    };
    const planned = (item: PlannedTurn) => message(item.text, at(`${item.day}T${item.time}:00Z`), item.thread);
    const days = [...new Set(PLAN.map(item => item.day))];
    for (const day of days) {
      const items = PLAN.filter(item => item.day === day && item.day !== '2026-09-27').map(planned);
      if (day === '2026-09-27') break;
      await deliver([...items, bulk(day, 0), bulk(day, 1)].sort((a, b) => a.message.date - b.message.date));
      if (day === '2026-09-24') worker = reopen(); // a restart the day of the first switch
    }
    // Sep 27: six probes around ordinary turns, two summary passes and a restart mid-day.
    const today = PLAN.filter(item => item.day === '2026-09-27');
    await deliver(today.slice(0, 3).map(planned));
    await deliver([...today.slice(3, 5).map(planned), bulk('2026-09-27', 0)]);
    worker = reopen();
    for (const item of today.slice(5)) await deliver([planned(item)], false);
    clock = at('2026-09-28T01:00:00Z');
    const probeAll = () => Object.fromEntries(QUESTIONS.map(question => {
      const result = worker.probe(question.text);
      if ('reason' in result) throw Error(`probe ${question.id} held: ${result.reason}`);
      return [question.id, result.context];
    }));
    const first = probeAll();
    worker = reopen();
    const packets = probeAll();
    const replayStable = QUESTIONS.every(question => first[question.id] === packets[question.id]);
    const view = journal.view;
    const probeTexts = new Set(PLAN.filter(item => item.kind.startsWith('probe')).map(item => item.text));
    const fromProbe = (source: string) => probeTexts.has(view.turns.get(source)?.text ?? '');
    const preferencesActive = view.memory.filter(change => change.mode === 'prefer');
    const result: ProbeReplayResult & { packets: Record<string, string> } = {
      rows: QUESTIONS.map(question => measure(question, packets[question.id]!)),
      summaries: { count: view.summaries.length, withProbe: view.summaries.filter(item => probeHits(item.text) > 0).length,
        probeHits: probeHits(view.summaries.at(-1)?.text ?? ''), controlJuniper: /niece Juniper/u.test(view.summaries.at(-1)?.text ?? '') },
      people: { total: view.people.length, fromProbe: view.people.filter(note => fromProbe(note.source)).length,
        control: view.people.some(note => note.name === 'Juniper' && /niece/u.test(note.quote)) },
      preferences: { active: preferencesActive.length, fromProbe: preferencesActive.filter(change => fromProbe(change.source)).length,
        control: preferencesActive.some(change => change.quote === 'I prefer short replies.') },
      commitments: { total: view.commitments.length, fromProbe: view.commitments.filter(note => fromProbe(note.source)).length },
      journal: { turns: view.order.length, probeTurns: view.order.filter(turn => probeTexts.has(turn.text)).length,
        auditable: [...probeTexts].every(text => view.order.some(turn => turn.text === text && turn.intent !== undefined)) },
      replayStable, sends, restarts, packets };
    journal.close();
    return result;
  } finally { rmSync(root, { recursive: true, force: true }); }
}
