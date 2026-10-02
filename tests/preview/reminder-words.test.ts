import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createJournalWorker, openPreviewJournal, openRequests } from './journal-test-worker.js';
import { ANSWER_INSTRUCTIONS, capabilityBriefing, SOURCE_PINS, sourcePacket } from './briefing.js';

/** Why this file exists. Live 2026-10-02 01:09-01:27 PDT, proof room two on a fresh root (build cint-L23
 * e26a8c1b), Rule 10's reminder path worked and said two untrue things.
 *
 * Fault 1 (Rules 78, 84 and the purpose's no-false-claims rule): "Remind me today at 1:25 am to refill the
 * bird feeder" was answered "I can't actually do this one -- I have no scheduler or background process ...
 * set a phone/calendar alarm", and the same bubble then carried the runner's own "I will act on this once
 * at 2026-10-02 01:25 ... and send you the result here". The request was recorded open and the reminder did
 * fire at 1:25. The reply contradicted both itself and the product.
 *
 * Fault 2 (Rules 10, 57, 93): "Also remind me today at 1:25 am to call the plumber" cancelled the bird
 * feeder request -- "This replaces the bird feeder reminder for that same time slot with the plumber one".
 * "Also" asks for both, and only the operator withdraws a request. */
const fixture = JSON.parse(readFileSync(new URL('./fixtures/reminderwords-live-2026-10-02.json', import.meta.url), 'utf8')) as {
  source: string;
  capabilityNote: { text: string; provenance: { excerptSha256: string }; excerptSha256Rederived: string };
  turns: { label: string; update: number; message: string; reply: string }[];
  requestedActionsAfterRa2: { requested: number; cancelled: number; open: { quote: string }[] } };
const recorded = (label: string) => fixture.turns.find(item => item.label === label)!;
const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');
const LIMITS = { providerAttempts: 1000, expiresAt: 1791232800000 };

/** The recorded fault, read off the exact bytes the live model was given. The note's digest is re-derived
 * from the fixture text and equals the provenance digest recorded live, so these really are those bytes. */
it('shows the contradiction the live model was given, and that this checkout no longer gives it', () => {
  expect(fixture.capabilityNote.excerptSha256Rederived).toBe(fixture.capabilityNote.provenance.excerptSha256);
  // What it listed as available, two lines above what denied it.
  expect(fixture.capabilityNote.text).toContain('- preview-requested-actions: ');
  expect(fixture.capabilityNote.text).toContain('no scheduled work, nudges or other unprompted messages');
  // And the reply that came out of it: the denial and the runner's receipt in one bubble.
  expect(recorded('ra1').reply).toContain('I have no scheduler or background process');
  expect(recorded('ra1').reply).toContain('I will act on this once at 2026-10-02 01:25');

  const note = capabilityBriefing(readSource, LIMITS).text;
  // The capability is still listed, and now says plainly when it is sent and that nothing more is needed.
  expect(note).toContain('- preview-requested-actions: ');
  expect(note).toMatch(/- preview-requested-actions: .*answered once at that time.*no new operator message\./u);
  // No blanket denial of it anywhere in the note.
  expect(note).not.toContain('no scheduled work');
  expect(note).not.toContain('unprompted messages');
});

/** Rule 84's other half: a capability the briefing states must not be denied by some other part of the
 * text that rides with every answer. The standing instructions and every composed source are checked
 * together, because the live reply's denial came from the briefing while the receipt came from the code. */
it('carries no denial of later-time sending anywhere in the always-sent text', () => {
  const always = [ANSWER_INSTRUCTIONS,
    ...sourcePacket(readSource, SOURCE_PINS, LIMITS).sources.map(item => `${item.title}\n${item.text}`)].join('\n');
  expect(always).toContain('preview-requested-actions');
  for (const denial of ['no scheduler', 'no scheduled work', 'unprompted', 'background process'])
    expect(always, denial).not.toContain(denial);
});

const key = new Uint8Array(32).fill(53);
// 2026-10-02 01:09 America/Los_Angeles, the live clock of the recorded turns.
const START = Date.UTC(2026, 9, 2, 8, 9);
const genesis = { kind: 'genesis' as const, bot: '8989505249', chat: '7812716706', operator: '7812716706',
  grant: 'grant:reminder-words', configurationDigest: 'sha256:reminder-words', expires: Date.UTC(2026, 9, 10),
  maxCalls: 40, maxReplies: 20, maxTurns: 20, maxBytes: 12000, cursor: 0 };
const update = (id: number, text: string) => ({ update_id: id,
  message: { chat: { id: 7812716706, type: 'private' }, from: { id: 7812716706 }, text,
    date: Math.floor(START / 1000) + id * 60 } });
type Input = { id: string; question: string; context: string };
type Reminder = { id: string; quote: string; due: string };
const offered = (input: Input) => (JSON.parse(input.context) as { reminders?: Reminder[] }).reminders ?? [];

/** One world, one model stand-in per test. `decide` returns the decision shape the test is replaying. */
function world(root: string, decide: (input: Input) => string) {
  const state = { now: START, sent: [] as string[] };
  const ports = { now: () => state.now, stopped: () => false, timeZone: 'America/Los_Angeles',
    model: async (input: Input) => input.id.startsWith('summary:')
      ? JSON.stringify({ summary: 'The operator asked for reminders.', people: [], memory: [], commitments: [], questions: [] })
      : decide(input),
    checkOutbound: () => {},
    send: async (value: { expectedText: string }) => { state.sent.push(value.expectedText); return state.sent.length; } };
  const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
  return { state, journal, worker: createJournalWorker(journal, ports) };
}
const tmp = (name: string) => realpathSync(mkdtempSync(join(tmpdir(), `preview-reminderwords-${name}-`)));
const FEEDER = recorded('ra1').message, PLUMBER = recorded('ra2').message;
/** The dated item the live run really recorded for each of those two messages. */
const request = (text: string) => ({ quote: text, when: 'today at 1:25 am', remind: true });

/** Fault 2, replayed. The recorded evidence for this turn is the operator's two messages, the reply
 * sentence claiming a replacement, and the status after it (requested 2, cancelled 1, the plumber the only
 * open request). The ra2 decision JSON itself was not captured, so the shape below is reconstructed from
 * exactly those facts: a new remind:true request plus a cancellation of the listed bird-feeder one, with
 * nothing in the operator's message cited as withdrawing it. */
it('refuses a cancellation the operator never asked for: an "also" request adds one and withdraws nothing', async () => {
  const root = tmp('also');
  try {
    const { state, journal, worker } = world(root, input => input.question === PLUMBER
      ? JSON.stringify({ reply: 'Noted.', memory: [], dated: [request(PLUMBER)],
        cancelReminders: offered(input).filter(item => item.quote.includes('bird feeder')).map(item => item.id) })
      : JSON.stringify({ reply: 'Okay.', memory: [], dated: [request(FEEDER)] }));
    worker.intake([update(1, FEEDER)]); await worker.drain();
    expect(openRequests(journal.view).map(item => item.quote)).toEqual([FEEDER]);
    // The reply to a plain dated request does not deny the capability; it states when it will be sent.
    expect(state.sent.at(-1)!).toContain('I will act on this once at 2026-10-02 01:25 (America/Los_Angeles)');

    worker.intake([update(2, PLUMBER)]); await worker.drain();
    // Live, this left one open request. Both stand now, in the order asked.
    expect(openRequests(journal.view).map(item => item.quote)).toEqual([FEEDER, PLUMBER]);
    expect(journal.view.reminderCancels).toHaveLength(0);
    // Rule 2: the refusal is said, in its own words, not folded into the unclear-id one.
    expect(state.sent.at(-1)!).toContain('Nothing in that message withdrew a request, so none was cancelled');
    expect(state.sent.at(-1)!).not.toContain('I could not tell which request to cancel');
    // And what the live reply said instead, for the record.
    expect(recorded('ra2').reply).toContain('This replaces the bird feeder reminder for that same time slot');
    expect(fixture.requestedActionsAfterRa2).toMatchObject({ requested: 2, cancelled: 1 });
    expect(fixture.requestedActionsAfterRa2.open).toHaveLength(1);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** The positive neighbour. An explicit withdrawal, quoted from the operator's own message, cancels exactly
 * the request it names and leaves the other standing. */
it('cancels exactly the request the operator withdrew, by their own words, and leaves the other open', async () => {
  const root = tmp('withdraw');
  try {
    const withdrawal = 'cancel the bird feeder one';
    const { state, journal, worker } = world(root, input => {
      if (input.question === FEEDER) return JSON.stringify({ reply: 'Okay.', memory: [], dated: [request(FEEDER)] });
      if (input.question === PLUMBER) return JSON.stringify({ reply: 'Noted.', memory: [], dated: [request(PLUMBER)] });
      return JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
        cancelReminders: offered(input).filter(item => item.quote.includes('bird feeder'))
          .map(item => ({ id: item.id, quote: withdrawal })) });
    });
    worker.intake([update(1, FEEDER), update(2, PLUMBER)]); await worker.drain();
    expect(openRequests(journal.view)).toHaveLength(2);
    worker.intake([update(3, `Actually, ${withdrawal}.`)]); await worker.drain();
    expect(openRequests(journal.view).map(item => item.quote)).toEqual([PLUMBER]);
    expect(state.sent.at(-1)!).toContain(`Cancelled request: "${FEEDER}".`);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** Both sides of the quote check itself, on one withdrawing message: words the operator really wrote are
 * admitted; a span the agent made up, or a bare id with no words at all, is not. Code checks only whose
 * words they are -- what they mean stays the model's to read (Rule 10). */
it.each([
  ['the operator\'s own words', (id: string) => [{ id, quote: 'cancel the bird feeder one' }], true],
  ['words from the agent\'s own reply', (id: string) => [{ id, quote: 'This replaces the bird feeder reminder' }], false],
  ['a bare id with no words', (id: string) => [id], false],
  ['a span too short to be a quote', (id: string) => [{ id, quote: 'one' }], false],
])('admits a withdrawal cited as %s: %s', async (_name, cite, admitted) => {
  const root = tmp('cite');
  try {
    const { state, journal, worker } = world(root, input => input.question === FEEDER
      ? JSON.stringify({ reply: 'Okay.', memory: [], dated: [request(FEEDER)] })
      : JSON.stringify({ reply: 'Okay.', memory: [], dated: [],
        cancelReminders: offered(input).flatMap(item => item.quote.includes('bird feeder') ? cite(item.id) : []) }));
    worker.intake([update(1, FEEDER)]); await worker.drain();
    worker.intake([update(2, 'Actually, cancel the bird feeder one.')]); await worker.drain();
    expect(openRequests(journal.view)).toHaveLength(admitted ? 0 : 1);
    expect(state.sent.at(-1)!).toContain(admitted ? 'Cancelled request:'
      : 'Nothing in that message withdrew a request, so none was cancelled');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/** The undated case the same fault spoiled: a5, "Please promise to remind me about watering the tomato
 * plants -- say you will", was answered "I have no scheduler or background process; I only exist when you
 * message me". A stub cannot prove what a model will now say, so what is checked here is what the packet
 * gives it: no denial, the capability listed, and a request with no time left for the operator to settle. */
it('leaves an undated promise unsettled without any denial in what the model is given', async () => {
  const root = tmp('promise');
  try {
    const seen: string[] = [];
    const { state, journal, worker } = world(root, input => {
      seen.push(input.context);
      return JSON.stringify({ reply: 'Tell me a day and time and I will send it then.', memory: [], dated: [] });
    });
    worker.intake([update(1, recorded('a5').message)]); await worker.drain();
    expect(openRequests(journal.view)).toHaveLength(0);
    expect(state.sent).toHaveLength(1);
    for (const denial of ['no scheduler', 'no scheduled work', 'unprompted', 'background process'])
      expect(seen.join('\n'), denial).not.toContain(denial);
    expect(recorded('a5').reply).toContain('I have no scheduler or background process');
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
