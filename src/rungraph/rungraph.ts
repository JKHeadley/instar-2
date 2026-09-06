import { constructGoverned, readRegisterEntry } from '../register/index.js';
import type { RegisterEntry } from '../register/index.js';
import type { Result } from '../index.js';
import { hashBytes } from '../facts/index.js';
import { boundary, encoded, need, same, take } from './boundary.js';
import { decodeRun, decodeRunStep, decodeRunTransition, decodeRunExit, decodeSessionGrounding } from './records.js';
import type { RunDecodeContext, RunGovernance } from './types.js';

// Admission consumers bind the actual decoder to the approved design entry.
// The register is verified by P3's loader; P5 never manufactures approval rows.
function contract(entry: RegisterEntry): void {
  need(!('state' in entry.approvedIn) && entry.declaration.status === 'live'
    && entry.declaration.kind === 'governed documents'
    && entry.declaration.requiredFacts.location === 'docs/09-the-run-graph.md', 'approved run contract unavailable');
}
function gate(g: RunGovernance, id: string, decoder: string, stop = false): void {
  const entry = take(readRegisterEntry(id, g.register, g.context)), d = entry.declaration, f = d.requiredFacts;
  need(d.kind === 'blocking sites' && d.status !== 'retired' && f.authority === 'block'
    && f.inspectedBy === 'P5-NF-54' && f.preservesInput === 'part-two:run-input'
    && f.failDirection === (stop ? 'open' : 'closed')
    && f.decidesAlone === (stop ? 'ruled-three' : 'governed-state'), 'run gate power/preservation/fail direction mismatch');
  if (!stop) need(same(f.enforces, { record: 'rungraph.contract', decoder }), 'run gate decoder binding mismatch');
  const p = d.profile;
  need(p?.consequence === 'control' && p.reversibility === 'costly' && p.reach === 'user' && p.surface === 'chat'
    && p.repeats.kind === 'bounded' && p.repeats.by === 'rungraph.bound', 'run gate understates worst-case profile');
}
export function preserveRunInput<T>(input: unknown, c: RunDecodeContext, g: RunGovernance, use: (c: RunDecodeContext) => Result<T>): Result<T> {
  // Preservation precedes even the outer unknown-input decoder. A failed capture
  // cannot grant admission. P2 retains the actual record bytes used by this slice.
  return boundary('PreserveRunInput', null, c, () => {
    need(g.capture?.owner === 'part-two' && typeof g.capture.preserve === 'function', 'P2 gate input preservation required');
    const reference = take(g.capture.preserve(input));
    const captured = c.facts.captures[reference];
    need(captured?.status === 'available' && captured.bytes !== null && captured.bytes === encoded(input).bytes
      && hashBytes(captured.bytes) === captured.hash, 'gate input was not durably captured');
    return take(use({ ...c, preserved: reference }));
  });
}
export function runAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance) {
  return boundary('GovernedRunAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.admit', g.register, g.context));
    contract(take(readRegisterEntry('rungraph.contract', g.register, g.context)));
    gate(g, 'rungraph.admit', 'decodeRun');
    return take(decodeRun(input, c));
  });
}
export function stepAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance) {
  return boundary('GovernedStepAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.step', g.register, g.context));
    contract(take(readRegisterEntry('rungraph.contract', g.register, g.context)));
    gate(g, 'rungraph.step', 'decodeRunStep');
    return take(decodeRunStep(input, c));
  });
}
export function transitionAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance) {
  return boundary('GovernedTransitionAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.transition', g.register, g.context));
    contract(take(readRegisterEntry('rungraph.contract', g.register, g.context)));
    gate(g, 'rungraph.transition', 'decodeRunTransition');
    return take(decodeRunTransition(input, c));
  });
}
export function exitAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance) {
  return boundary('GovernedExitAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.exit', g.register, g.context));
    contract(take(readRegisterEntry('rungraph.contract', g.register, g.context)));
    gate(g, 'rungraph.exit', 'decodeRunExit');
    return take(decodeRunExit(input, c));
  });
}
export function groundingAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance) {
  return boundary('GovernedGroundingAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.grounding', g.register, g.context));
    contract(take(readRegisterEntry('rungraph.contract', g.register, g.context)));
    gate(g, 'rungraph.grounding', 'decodeSessionGrounding');
    return take(decodeSessionGrounding(input, c));
  });
}
export function stopAdmission(input: unknown, c: RunDecodeContext, g: RunGovernance) {
  return boundary('GovernedStopAdmission', null, c, () => {
    take(constructGoverned('blocking sites', 'rungraph.stop', g.register, g.context));
    gate(g, 'rungraph.stop', 'decodeRunTransition', true);
    const transition = take(decodeRunTransition(input, c));
    need(transition.kind === 'stop', 'stop gate cannot authorize ordinary work');
    // Service consumes P4's authenticated reach witness under six's fence. A
    // signal/notification failure cannot convert this stop into permission.
    return transition;
  });
}
export function runGraphConstruct(g: RunGovernance) {
  take(constructGoverned('features', 'rungraph-core', g.register, g.context));
  take(constructGoverned('critical outcomes', 'rungraph.bound', g.register, g.context));
  take(constructGoverned('governed documents', 'rungraph.contract', g.register, g.context));
  for (const [id, decoder] of [['rungraph.admit', 'decodeRun'], ['rungraph.step', 'decodeRunStep'], ['rungraph.transition', 'decodeRunTransition'],
    ['rungraph.exit', 'decodeRunExit'], ['rungraph.grounding', 'decodeSessionGrounding'], ['rungraph.stop', 'decodeRunTransition']]) gate(g, id!, decoder!, id === 'rungraph.stop');
  contract(take(readRegisterEntry('rungraph.contract', g.register, g.context)));
}
