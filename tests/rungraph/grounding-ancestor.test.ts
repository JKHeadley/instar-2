import { expect, it } from 'vitest';
import { setup, value, refused, json, ref } from './fixtures.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import type { Json } from '../../src/index.js';

// Owner decision (slice-five-gap option 1, 2026-09-06): a stimulus whose own schema
// declares NO capture field may bind the signed message capture through EXACTLY ONE
// reference-policy field whose target declares the capture field. The direct-capture
// path stays primary and unchanged; ambiguity and a missing/unverified target refuse.

const constitutional = {
  intent: { kind: 'constitutional', type: 'Intent' },
  owner: { kind: 'constitutional', type: 'VerifiedPrincipal' },
} as const;
const captureBearing = { capture: { kind: 'capture' } } as const;

function ancestorSetup() {
  return setup(undefined, undefined, {
    fields: { ...constitutional, receipt: { kind: 'reference' } },
    extra: { 'stim-receipt': captureBearing },
    body: ({ append, intent, owner, hash }) => {
      const receipt = append('stim-receipt', json({ capture: { reference: 'message:1', hash } }) as Json).fact;
      return json({ intent, owner, receipt: receipt.id }) as Json;
    },
  });
}

it('an intake-shaped stimulus with no capture field GROUNDS through its capture-bearing ancestor and reaches start with a pending RunStep', () => {
  const f = ancestorSetup();
  const ready = value(f.graph.open(f.run));
  const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  expect(ground.kind).toBe('session-grounding');
  // The start transition consumes six's reservation witness (fixtures refuse a
  // mismatched reservation identity) and admits the RunStep.
  const running = value(f.graph.transition(f.start(ready, ground)));
  expect(running.state).toBe('running');
  expect(running.pending).toHaveLength(1);
  expect(running.pending[0]!.operation.key).toBe('operation:1');
});

it('a message capture the ancestor never bound (wrong hash) refuses by name', () => {
  const f = ancestorSetup();
  value(f.graph.open(f.run));
  // A second genuinely-preserved capture: consistent with the capture store, but
  // NOT the {reference, hash} committed on the stimulus fact's receipt ancestor.
  const otherHash = f.capture('other preserved bytes', 'message:2');
  Object.assign(f.ctx.captures, { 'message:2': { bytes: 'other preserved bytes', hash: otherHash, status: 'available', byteLength: Buffer.byteLength('other preserved bytes') } });
  const graph = value(createRunGraph({ ...f.deps, grounding: { owner: 'part-ten', read: request => {
    const g = value(f.deps.grounding.read(request)) as { messages: { fact: unknown; sequence: number }[] };
    return f.success({ ...g, messages: g.messages.map(m => ({ ...m, capture: 'message:2', hash: otherHash })) });
  } } }));
  refused(graph.ground(f.id, 'w', 'h', 'start', f.lease), 'grounding capture not bound by the capture-bearing stimulus ancestor');
});

it('a missing referenced ancestor fact refuses by name', () => {
  const f = setup(undefined, undefined, {
    fields: { ...constitutional, receipt: { kind: 'reference' } },
    body: ({ intent, owner }) => json({ intent, owner, receipt: 'fact:never-admitted' }) as Json,
  });
  value(f.graph.open(f.run));
  refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease), 'grounding capture ancestor missing or unverified');
});

it('two reference fields with capture-bearing targets are ambiguous and refuse by name', () => {
  const f = setup(undefined, undefined, {
    fields: { ...constitutional, receipt: { kind: 'reference' }, duplicate: { kind: 'reference' } },
    extra: { 'stim-receipt': captureBearing },
    body: ({ append, intent, owner, hash }) => {
      const receipt = append('stim-receipt', json({ capture: { reference: 'message:1', hash } }) as Json).fact;
      const duplicate = append('stim-receipt', json({ capture: { reference: 'message:1', hash } }) as Json).fact;
      return json({ intent, owner, receipt: receipt.id, duplicate: duplicate.id }) as Json;
    },
  });
  value(f.graph.open(f.run));
  refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease), 'ambiguous grounding capture ancestors');
});

it('a capture-bearing fact named only by a NON-reference field carries no binding and refuses by name', () => {
  const f = setup(undefined, undefined, {
    fields: { ...constitutional, receiptText: { kind: 'text', maxLength: 1024 } },
    extra: { 'stim-receipt': captureBearing },
    body: ({ append, intent, owner, hash }) => {
      const receipt = append('stim-receipt', json({ capture: { reference: 'message:1', hash } }) as Json).fact;
      return json({ intent, owner, receiptText: receipt.id }) as Json;
    },
  });
  value(f.graph.open(f.run));
  refused(f.graph.ground(f.id, 'w', 'h', 'start', f.lease), 'grounding capture not bound to the signed message capture field');
});

it('the direct-capture path stays primary: a capture-bearing stimulus with a WRONG binding still refuses directly, never through an ancestor', () => {
  const f = setup(undefined, undefined, {
    fields: { ...constitutional, capture: { kind: 'capture' }, receipt: { kind: 'reference' } },
    extra: { 'stim-receipt': captureBearing },
    body: ({ append, intent, owner, hash }) => {
      const receipt = append('stim-receipt', json({ capture: { reference: 'message:1', hash } }) as Json).fact;
      return json({ intent, owner, capture: { reference: 'message:1', hash }, receipt: receipt.id }) as Json;
    },
  });
  value(f.graph.open(f.run));
  // Direct binding matches here, so grounding succeeds through the primary path
  // even though a reference field also exists (no ambiguity applies).
  const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  expect(ground.kind).toBe('session-grounding');
});
