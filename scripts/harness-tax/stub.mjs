import { digest } from './runner.mjs';
/** Plumbing proof only. Reads the fixture; no login, process, network or semantic-performance claim. */
export const driver = { async execute(request) {
  const text = request.fixtures['reference.md'];
  return { requestId: request.id, model: request.model, state: 'complete',
    observation: { reply: text ?? 'Stub boundary observed; not a model answer.', boundary: request.boundary, simulated: true },
    evidence: [`stub:${request.id}:fixture:${digest(request.fixtures)}`], breaches: [], totals: { tokens: 0, calls: 0 },
    costs: [{ id: 'fixture-read', part: 'model-work', tokens: 0, calls: 0, wallMs: 0, evidence: 'local fixture replay, no model invocation' }] };
} };
export const grader = { async grade({ task, result }) {
  const correct = task.id === 'lookup' && result.observation.reply === task.fixtures['reference.md'];
  return { reviewer: 'stub-fixture-oracle (not semantic evaluation)', resultDigest: digest(result),
    correctness: correct ? 'pass' : 'unknown', trust: Object.fromEntries(task.trust.map(k => [k, correct ? 'pass' : 'unknown'])),
    cost: { tokens: 0, calls: 0, wallMs: 0, evidence: 'local stub comparison' },
    reason: correct ? 'Fixture reached the recorded observation intact.' : 'No live behavior established by a stub.', evidence: result.evidence };
} };
