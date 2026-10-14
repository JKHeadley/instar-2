import { expect, it } from 'vitest';
import { rebuildConversationReadView } from '../../src/recall/read-view.js';
import { openRunWorkProjection } from '../../src/rungraph/read-view.js';
import { closingRun, setup, value, refused, ref } from './fixtures.js';

function projection(f: ReturnType<typeof setup>) {
  return openRunWorkProjection({ snapshot: value(f.store.readForProjection()), generation: f.generation(),
    context: f.context(), now: f.now,
    witnesses: { verify: fact => f.deps.admission.verify(ref(fact)) },
    conversation: view => view.run.resultDestination.binding.id });
}
it('indexes real owner-replayed open work and excludes a proven completed run after refresh', () => {
  const f = closingRun();
  const before = value(rebuildConversationReadView(f.store, f.c, projection(f)));
  expect(before.work('binding:1')).toEqual([value(f.graph.read(f.id))]);
  expect(before.work('binding:1')[0]?.state).toBe('closing');
  value(f.graph.transition(f.close));
  const after = value(rebuildConversationReadView(f.store, f.c, projection(f)));
  expect(after.work('binding:1')).toEqual([]);
  expect(before.work('binding:1')[0]?.state).toBe('closing');
});
it('keeps waiting uncertain work open and refuses mismatched source or missing admission', () => {
  const f = setup(), ready = value(f.graph.open(f.run));
  const ground = value(f.graph.ground(f.id, 'w', 'h', 'start', f.lease));
  const running = value(f.graph.transition(f.start(ready, ground)));
  value(f.graph.transition(f.observe(running)));
  const work = projection(f);
  const view = value(rebuildConversationReadView(f.store, f.c, work));
  expect(view.work('binding:1')).toEqual([value(f.graph.read(f.id))]);
  expect(view.work('binding:1')[0]?.state).toBe('waiting');
  f.append('note', { identity: 'later', amount: '0' });
  refused(rebuildConversationReadView(f.store, f.c, work), 'differs');
  const missing = projection(f); f.admissions.clear();
  refused(rebuildConversationReadView(f.store, f.c, missing), 'not admitted');
});
