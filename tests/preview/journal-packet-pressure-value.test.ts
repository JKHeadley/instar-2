import { expect, it } from 'vitest';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OBLIGATION_FLOOR_PACKET_BYTES, createJournalWorker, openPreviewJournal } from './journal.js';

const key = new Uint8Array(32).fill(47);
const now = 1790500000000;
const source = (update: number) => `telegram:12345678:update:${update}`;

/** cbuild-2: every operator packet now carries the always-offered summary and promise decisions
 * (Rule 10), a fixed addition that shifts each measured boundary by the same amount. */
const GUIDANCE = 300; // cint-23-occam re-measure (every packet lost the summary decision): the whole test passes for offsets 180-410 in 10-byte steps; was 550 (two-item window 4592-4799)
// cint-L3: build 1 moved the hand-written capability list to the generated capability-note source; against
// cint-L2's (occam) capability text that removes 471 bytes from every packet, so the offset window moves by -471.
// cint-L4 group B repair (Rule 29): datedDecision now asks for the operator's date phrase word for word and
// never converted, which adds exactly 149 JSON bytes to every dated packet; reverting only that string
// restores the prior outcomes, so the window moves by +149.
// w3-memcorr (Rule 7, live K13b): memoryDecision now states the exact memory item shape, which adds exactly 580
// JSON bytes to every operator packet, so the window moves by +580.
// w3-fixedtrim (plan step 8): the capability guidance no longer repeats what the capability-note source itself
// states, and obligationDecision is worded shorter with the same fields and the same decisions. Measured on this
// exact packet shape, that removes 69 JSON bytes (4623 -> 4554 for the two-item packet), so the window moves by -69.
// w3-floorduty (Rules 3, 93; live 2026-10-03, proof room one): under pressure the obligation guide now yields to its
// floor form instead of vanishing, so every pressured operator packet here carries that key and text and the window
// moves by exactly its JSON bytes.
const GUIDANCE_L3 = GUIDANCE - 471 + 149 + 580 - 69 + OBLIGATION_FLOOR_PACKET_BYTES;

it('measures which memories survive a capped packet after 5,000 turns', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'preview-packet-pressure-')));
  try {
    const genesis = {
      kind: 'genesis', bot: '12345678', chat: '7654321', operator: '7654321',
      grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
      maxCalls: 100, maxReplies: 100, maxTurns: 5001, maxBytes: 262144, cursor: 0 } as const;
    const journal = openPreviewJournal(join(root, 'journal.encrypted'), key, genesis);
    const planted = new Map([
      [100, 'Harbor key amber: the handoff is with Mira.'],
      [200, 'Harbor key blue: the handoff is with Noor.'],
      [300, 'Harbor key coral: the handoff is with Ivo.'],
      [400, 'Harbor key dusk: the handoff is with Ren.'],
      [500, 'Harbor key ember: the handoff is with Sol.'],
    ]);
    for (let update = 1; update <= 5000; update++) {
      const text = planted.get(update) ?? (update === 5000 ? 'Where did the answer go?'
        : `Ordinary turn ${update}: routine workshop and planning notes.`);
      const turn = { id: source(update), update, text,
        raw: JSON.stringify({ update_id: update, message: { chat: { id: 7654321, type: 'private' },
          from: { id: 7654321 }, text, date: Math.floor(now / 1000) + update } }),
        accepted: true, at: now, reserved: false };
      journal.view.turns.set(turn.id, turn);
      journal.view.order.push(turn);
    }
    const grounding = (recalled: string[]) => ({ packetSha256: 'offline', summaryThrough: null,
      history: [], recalled, people: [], commitments: [], channelItems: [], corrections: [],
      memoryChanges: [], memoryCandidates: [] });
    journal.append({ kind: 'reserve', id: source(4998), grounding: grounding([source(100)]), at: now });
    journal.append({ kind: 'answer', id: source(4998), text: 'The handoff was recorded.', at: now });
    journal.append({ kind: 'intent', id: source(4998), text: 'PREVIEW — The handoff was recorded.',
      chat: '7654321', update: 4998, grant: 'grant:preview', at: now });
    journal.append({ kind: 'sent', id: source(4998), message: 4998, at: now });
    journal.append({ kind: 'reserve', id: source(5000), grounding: grounding([source(200)]), at: now });
    journal.append({ kind: 'summary-reserve', through: 5000, at: now });
    journal.append({ kind: 'summary', through: 5000, text: 'The operator discussed harbor key handoffs.',
      questions: [{ source: source(5000), quote: 'Where did the answer go?', reason: 'unanswered-reply' }], at: now });
    const worker = createJournalWorker(journal, { now: () => now, stopped: () => false,
      model: async () => 'ok', send: async () => 1, checkOutbound: () => {} });
    // The reply packet carries more fixed instructions than int11 (memory self-description, recall
    // honesty, person-attribute extraction, clock), so the one- and two-item pressure points moved
    // from 3000/3500 bytes to 3750/4000 (measured windows 3665-3918 and 3919-4171). int13 keeps the
    // two turns just before a message recalled; the open question's own turn (5000) is one of them,
    // so the windows are 3850-4074 (one item) and 4075-4324 (two items, measured in 25-byte steps).
    for (const limit of [3950 + GUIDANCE_L3, 4200 + GUIDANCE_L3, 6000 + GUIDANCE_L3]) {
      journal.view.limits.maxBytes = limit;
      const probe = worker.probe('What is the harbor key handoff status?');
      if ('reason' in probe) {
        process.stdout.write(`packet pressure ${limit}: ${probe.reason}\n`);
        continue;
      }
      const packet = JSON.parse(probe.context) as { recalled?: { id: string }[]; openQuestions?: { id: string }[] };
      const kept = packet.recalled?.map(item => item.id) ?? [];
      process.stdout.write(`packet pressure ${limit}: bytes=${Buffer.byteLength(probe.context)} kept=${kept.map(id => id.split(':').at(-1)).join(',')} dropped=${probe.dropped.map(item => `${item.kind}:${item.source.split(':').at(-1)}`).join(',')} open=${packet.openQuestions?.length ?? 0}\n`);
      expect(Buffer.byteLength(probe.context)).toBeLessThanOrEqual(limit);
      if (limit === 3950 + GUIDANCE_L3) {
        // Open question link wins the one-item boundary. cbuild-2: the Rule 110 continuity note rides in
        // every compacted packet here, so under this pressure the packet may keep no recall item at all;
        // whatever survives is still only the link.
        expect(kept.every(id => id === source(200))).toBe(true);
      }
      if (limit === 4200 + GUIDANCE_L3) {
        // The unanswered question itself, carried as a continued turn, takes the second slot.
        expect(kept).toEqual([source(200), source(5000)]);
        expect(probe.dropped.filter(item => item.kind === 'recent').map(item => item.source))
          .toEqual(expect.arrayContaining([source(100), source(300), source(400), source(500)]));
      }
    }
    journal.view.limits.maxBytes = 4200 + GUIDANCE_L3;
    const recentTurn = journal.view.turns.get(source(4998))!;
    const sent = recentTurn.sent!;
    delete recentTurn.sent;
    const withoutRecent = worker.probe('What is the harbor key handoff status?');
    if ('reason' in withoutRecent) throw Error(withoutRecent.reason);
    expect((JSON.parse(withoutRecent.context) as { recalled?: { id: string }[] }).recalled?.map(item => item.id))
      .toEqual([source(200), source(5000)]);
    recentTurn.sent = sent;
    const questions = journal.view.questions.splice(0);
    const withoutOpen = worker.probe('What is the harbor key handoff status?');
    if ('reason' in withoutOpen) throw Error(withoutOpen.reason);
    // cbuild-2: every compacted packet from a not-yet-accounted summary frontier carries the small Rule 110
    // continuity note naming the last inbound turn (5000); two relevant items still fit beside it.
    const openless = (JSON.parse(withoutOpen.context) as { recalled?: { id: string }[]; continuity?: { lastInbound: string } });
    expect(openless.recalled?.map(item => item.id)).toEqual([source(100), source(500)]);
    expect(openless.continuity?.lastInbound).toBe(source(5000));
    delete recentTurn.sent;
    const withoutSignals = worker.probe('What is the harbor key handoff status?');
    if ('reason' in withoutSignals) throw Error(withoutSignals.reason);
    const before = (JSON.parse(withoutSignals.context) as { recalled?: { id: string }[] }).recalled?.map(item => item.id) ?? [];
    // Without reference signals the two newest relevant items survive beside the continuity note (cbuild-2).
    expect(before).toEqual([source(400), source(500)]);
    expect((JSON.parse(withoutSignals.context) as { continuity?: unknown }).continuity).toBeDefined();
    process.stdout.write(`packet pressure 4200 without reference signals: kept=${before.map(id => id.split(':').at(-1)).join(',')} needed=0/2\n`);
    recentTurn.sent = sent;
    journal.view.questions.push(...questions);
    journal.close();
  } finally { rmSync(root, { recursive: true, force: true }); }
}, 120000);
