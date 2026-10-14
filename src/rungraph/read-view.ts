// Open-work evidence comes from Five's existing authoritative replay, never a second fold.
import type { Clock } from '../index.js';
import type { FactEnvelope, FactSnapshot } from '../facts/index.js';
import type { ProjectionGeneration } from '../projections/index.js';
import type { WorkReadProjection } from '../recall/read-view.js';
import { boundary, need, object, take } from './boundary.js';
import { foldRun } from './graph.js';
import type { GroundingValidationOptions } from './graph.js';
import { runKinds } from './records.js';
import type { RunDecodeContext, RunReplayPort, RunView } from './types.js';

/** Bind the conversation read view's work index to the existing run owner. All work is
 * replayed at refresh; only nonterminal views enter the index. Uncertainty/conflict
 * remains open. This is evidence as-of the snapshot, not authority to launch or send.
 * The composition supplies the established binding-to-conversation mapping. */
export function openRunWorkProjection(input: Readonly<{
  snapshot: FactSnapshot; generation: ProjectionGeneration; context: RunDecodeContext;
  now: Clock; witnesses: RunReplayPort; grounding?: GroundingValidationOptions;
  conversation: (work: RunView) => string;
}>): WorkReadProjection<RunView> {
  return Object.freeze({ conversation: input.conversation,
    fold: (facts: readonly FactEnvelope[]) => boundary('OpenRunWorkProjection', null, input.context, () => {
      const entries = input.snapshot.entries;
      need(facts.length === entries.length && facts.every((fact, i) => fact.id === entries[i]!.fact.id
        && fact.contentHash === entries[i]!.fact.contentHash), 'work snapshot differs from conversation read source');
      const ids = new Set(facts.filter(fact => fact.kind === runKinds.Run).map(fact => object(fact.body).run));
      const open: RunView[] = [];
      for (const id of ids) {
        need(typeof id === 'string', 'run identity missing');
        const view = take(foldRun(id, input.snapshot, input.generation, input.context, input.now,
          input.witnesses, input.grounding));
        if (view.state !== 'completed' && view.state !== 'unreachable' && view.state !== 'cancelled') open.push(view);
      }
      return open;
    }) });
}
