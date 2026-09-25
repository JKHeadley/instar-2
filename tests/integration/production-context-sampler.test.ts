// @ts-nocheck -- R5 real Two/Five/Ten/Seven preparation and capture joins, tamper cases and restart.
// External model IO is a SYNTHETIC in-process adapter stand-in that records the bytes it
// would receive; no provider, Telegram or network call is made in this file.
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';
import { createFactStore } from '../../src/facts/index.js';
import { createProviderJudgmentPort } from '../../src/judgment/index.js';
import { verifyGroundedSubmission } from '../../src/assembly/production-context-sampler.js';
import { createJudgmentCaptures } from '../../scripts/judgment-captures.mjs';
import { groundingFixture, withSeven } from '../assembly/production-context-sampler-fixture.js';
import { refused, value } from '../facts/fixtures.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const QUESTION_ONE = 'What is Instar for?';
const QUESTION_TWO = 'Can this installation talk in any conversation other than this one?';
const SECOND_DETAIL = 'one pre-bound Telegram conversation';
const PROPOSED_INPUT_BOUND = 16384; // the R5 proposed Seven route bound; see progress handoff

function turnOne(maxInputBytes = PROPOSED_INPUT_BOUND) {
  const f = groundingFixture(), directory = mkdtempSync(join(tmpdir(), 'r5-join-'));
  directories.push(directory);
  const s = withSeven(f, directory, maxInputBytes);
  const ready = value(f.graph.open(f.run)), ground = value(f.graph.ground(f.id, 'w', 'native', 'start', f.lease));
  const rendered = value(f.render());
  const calls: string[] = [];
  const joinInput = (prepared, bindings = f.bindings(), replies = [], store = f.store, captures = f.captures) => ({
    store, context: f.p.context, captures, bindings, replies, request: prepared.value,
    requestFact: prepared.request.id });
  /** Synthetic adapter: the verifier runs before the stand-in external call records any bytes. */
  const invoke = (prepared, bytes, bindings = f.bindings()) => {
    value(verifyGroundedSubmission({ ...joinInput(prepared, bindings), received: bytes }));
    calls.push(bytes);
  };
  return { f, s, ready, ground, rendered, joinInput, invoke, calls, directory };
}
const submittedOf = (t, prepared) => value(t.s.captures.read(prepared.value.submitted));

describe('R5 manifest-to-Seven join', () => {
  it('Seven captures exactly the delivered manifest evidence and the adapter bytes equal that capture', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    const submitted = submittedOf(t, prepared);
    expect(submitted).toBe(t.s.submission(QUESTION_ONE, t.rendered).bytes);
    const joined = value(verifyGroundedSubmission(t.joinInput(prepared)));
    expect(joined.digest).toBe(prepared.value.inputDigest);
    expect(joined.rows).toBe(5);
    // Independent resolution: the persisted delivery's manifest rows and their owner facts.
    const { specification } = t.f.delivered();
    const packet = JSON.parse(JSON.parse(submitted).messages[1].content);
    for (const row of specification.contextManifest.filter(r => r.class !== 'message')) {
      const fact = value(t.f.store.read()).find(candidate => candidate.id === row.reference);
      expect(fact.contentHash).toBe(row.digest);
      expect(JSON.stringify({ items: packet.sources.find(source => source.reference === row.reference).items }))
        .toBe(fact.body.content);
    }
    expect(submitted).toContain('Make coherence something an AI cannot lose.');
    t.invoke(prepared, submitted);
    expect(t.calls).toEqual([submitted]);
  }, 60000);

  it('second turn carries the source-only detail, the pending predecessor and both inputs exactly once', () => {
    const t = turnOne();
    value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    t.f.nextInput(QUESTION_TWO);
    value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    const packet = JSON.parse(value(t.f.render()));
    expect(packet.conversation.map(entry => Object.keys(entry).sort().join())).toEqual(['capture,hash,input,text', 'capture,hash,input,text']);
    expect(packet.conversation.map(entry => entry.input)).toEqual(t.f.plan.frontier);
    // The second detail is source-only: absent from every conversation turn, present in the delivered contract excerpt.
    expect(packet.conversation.some(entry => entry.text.includes(SECOND_DETAIL))).toBe(false);
    expect(packet.sources[1].items[0].content).toContain(SECOND_DETAIL);
    expect(packet.bindings.step).toBe('step:operation:2');
  }, 60000);
});

describe('R5 negative joins refuse before any adapter invocation', () => {
  const tampered = (mutate) => {
    const t = turnOne();
    const packet = JSON.parse(t.rendered); mutate(packet, t);
    const bytes = JSON.stringify(packet);
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, bytes));
    expect(() => t.invoke(prepared, submittedOf(t, prepared))).toThrow();
    expect(t.calls).toHaveLength(0);
    return refused(verifyGroundedSubmission(t.joinInput(prepared)));
  };
  it('source text removed while its digest is retained', () => {
    expect(tampered(packet => { packet.sources[0].items[0].content = ''; })).toContain('submitted source identity differs');
  }, 60000);
  it('a digest/receipt without any source text', () => {
    expect(tampered(packet => { packet.sources = packet.sources.map(({ items, ...rest }) => rest); }))
      .toContain('submitted source identity differs');
  }, 60000);
  it('a replaced body version', () => {
    expect(tampered(packet => { packet.sources[1].items[0].standing.version = 'r5-offline-v2'; }))
      .toContain('submitted source rules differs');
  }, 60000);
  it('one changed UTF-8 byte in source text', () => {
    expect(tampered(packet => { packet.sources[1].items[0].content = packet.sources[1].items[0].content.replace('draft', 'drafT'); }))
      .toContain('submitted source rules differs');
  }, 60000);
  it('one changed conversation byte and an omitted history row', () => {
    expect(tampered(packet => { packet.conversation[0].text = packet.conversation[0].text.replace('initial', 'initiaL'); }))
      .toContain('submitted input 0 differs');
    expect(tampered(packet => { packet.conversation = []; })).toContain('omits or adds a turn');
  }, 120000);
  it('another turn\'s packet replayed into this turn', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    t.f.nextInput(QUESTION_TWO);
    value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    // The turn-one packet (its bindings, manifest and single input) presented against turn two's delivery.
    const second = { ...t.f.bindings(), step: 'step:operation:1' };
    expect(() => t.invoke(prepared, submittedOf(t, prepared), second)).toThrow(/bindings differ/);
    expect(t.calls).toHaveLength(0);
  }, 60000);
});

describe('R5 restart reconstruction', () => {
  it('reopens durable storage, reconstructs the same request without re-dispatch, then freshly samples a distinct turn', () => {
    const t = turnOne();
    const prepared = value(t.s.prepareTurn(t.ready, t.ground, 'operation:1', QUESTION_ONE, t.rendered));
    const original = submittedOf(t, prepared), bindings = t.f.bindings();
    // Reopen: a fresh FactStore over the same durable wire and fresh file-backed Seven captures.
    const store = createFactStore(t.f.ctx, t.f.storage);
    const reopened = createJudgmentCaptures(t.directory, {}, fn => t.f.success(fn()), 1048576, {});
    const captures = { read: reference => reference.startsWith('judgment-capture:')
      ? value(reopened.read({ reference, hash: reference.slice('judgment-capture:'.length) })) : t.f.captures.read(reference) };
    const seven = createProviderJudgmentPort({ ...t.s.judgment, store, captures: reopened });
    const recovered = value(seven.readPrepared(prepared.request));
    expect(recovered.value).toEqual(prepared.value);
    value(verifyGroundedSubmission({ ...t.joinInput(recovered, bindings, [], store, captures), received: original }));
    const packet = JSON.parse(JSON.parse(original).messages[1].content);
    expect(packet.sources[2].items[0].content).toBe('Operator constraint: answer in at most two sentences.');
    expect(t.calls).toHaveLength(0);
    // A distinct next turn is freshly sampled; the recorded request cannot masquerade as it.
    t.f.nextInput(QUESTION_TWO);
    value(t.f.graph.ground(t.f.id, 'w', 'native', 'resume', t.f.lease));
    const next = t.f.bindings();
    expect(next.delivery).not.toBe(bindings.delivery);
    refused(verifyGroundedSubmission(t.joinInput(recovered, { ...next, step: 'step:operation:1' }, [], store, captures)), 'bindings differ');
    value(verifyGroundedSubmission(t.joinInput(recovered, bindings, [], store, captures)));
  }, 60000);
});
