/** Recorded recall evidence survives summary and an injected packet ceiling; no live provider. */
import { expect, it } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fact, fixture, neutral, question, room, sourceId, update, withRoom } from './recall-rank-room.js';
import { conclusionText, parseModelJson } from './model-json.js';

type Packet = { history?: { id: string }[]; recalled?: { id: string; user: string; conversation?: string }[] };
const shapes = JSON.parse(readFileSync(new URL('./fixtures/retrospective-duty-followup-train-1-2026-10-08.json', import.meta.url), 'utf8')) as
  { otherShapes: { kind: string; id: string; raw: string }[] };
const samples = (fixture as unknown as { lookupSamples: { samples: { label: string; calls: { raw: string }[] }[] } }).lookupSamples.samples;
const recorded = samples.find(item => item.label === 'P1')!.calls[1]!.raw;
const parsed = parseModelJson(recorded);
if (!parsed.ok) throw Error('recorded answer missing');
const reply = conclusionText((parsed.value.conclusion as { value: unknown }).value)!;

it.each(shapes.otherShapes)('keeps indexed original evidence under pressure beside recorded $kind ($id)', async shape => {
  for (const crossConversation of [false, true]) {
    const dir = realpathSync(mkdtempSync(join(tmpdir(), 'recall-keep-')));
    const sent: string[] = [], packets: Packet[] = [];
    const opened = room(join(dir, 'journal.encrypted'), 'A', [], neutral, {
      prepareModel: input => {
        const packet = JSON.parse(input.context) as Packet;
        // Two original quotes fit. This simulates envelope pressure without CPU load or model calls.
        if ((packet.recalled?.length ?? 0) > 2) throw Error('preview: complete prompt overflow');
        return input.context;
      },
      model: async input => {
        const packet = JSON.parse(input.context) as Packet;
        packets.push(packet);
        return reply;
      },
      send: async input => { sent.push(input.text); return input.update; },
    });
    try {
      // Recorded worker shapes remain historical data, never evidence replacing the original fact.
      const other = opened.journal.view.order.find(item => item.update !== fact.update)!;
      other.intent = shape.raw;
      if (crossConversation) opened.journal.view.turns.get(sourceId(fact.update))!.thread = 42;
      opened.worker.intake([update(question.update, question.message)]);
      await opened.worker.drain();
      expect(packets).toHaveLength(1);
      const packet = packets[0]!;
      expect(packet.history?.map(item => item.id)).not.toContain(sourceId(fact.update));
      expect(packet.recalled).toEqual(expect.arrayContaining([expect.objectContaining({
        id: sourceId(fact.update), user: fact.message,
        ...(crossConversation ? { conversation: expect.any(String) } : {}),
      })]));
      expect(sent).toEqual([expect.stringContaining('2958')]);
      expect(opened.journal.view.turns.get(sourceId(question.update))!.packetDropped?.length ?? 0).toBeGreaterThan(0);
    } finally { opened.journal.close(); rmSync(dir, { recursive: true, force: true }); }
  }
}, 120_000);

it('does not promote the stored fact for unrelated or absent details', () => {
  withRoom('A', [], ({ recalled }) => {
    for (const text of ['What is 17 times 3?', "What did I say my sister’s middle name is?"]) {
      const { packet, ids } = recalled(text);
      expect(ids).not.toContain(fact.update);
      expect(JSON.stringify(packet.recalled ?? [])).not.toContain('2958');
    }
  }, neutral);
});
