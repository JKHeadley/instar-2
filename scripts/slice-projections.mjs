// docs/15 section 4: the minimal plane's six disposable projections.
//
// Every definition declares EVERY admitted fact kind as consumed or ignored, reads
// only the spine plus a pinned register generation, and produces canonical bytes.
// None of them is authority: all six are `informational`, and a stale or missing
// view is rebuilt from facts.
//
// HONEST LIMIT (reported to Echo in .instar/lanes/slice-two-gap.md): part two's
// closed fold language addresses only TOP-LEVEL body fields. Parts five, six, seven
// and eight place their record identity beneath `record`, so a part-eleven fold
// cannot key on those bodies. Those kinds are therefore declared `ignores` with that
// exact reason, and the plane folds the part-eleven-owned obligation/evidence facts
// the chain itself writes at each durable boundary. Those facts are cross-checked
// against the owners' facts by the acceptance predicate, so the view cannot invent
// a state its owner never recorded.

const NESTED = 'Owner record identity lives under `record`; part two\'s fold language addresses only top-level body fields.';
const ignore = reason => ({ kind: 'ignores', reason });
const fold = (merge, identity, value) => ({ kind: 'folds', merge, identity, value });

function definition(id, stalenessBound, kinds, decisions, note) {
  const complete = {};
  for (const kind of kinds) complete[kind] = decisions[kind] ?? ignore(defaultReason(kind, note));
  return { id, class: 'informational', stalenessBound, retention: 'all-identities', decisions: complete };
}
function defaultReason(kind, note) {
  if (/^(transport|judgment|effect)-/.test(kind) || ['run-opening', 'run-transition', 'session-grounding'].includes(kind)) return NESTED;
  return note;
}

/** @param kinds every admitted fact kind of the running plane, in the pinned generation. */
export function minimalPlaneProjections(kinds, stalenessBound = 100000) {
  const all = [...kinds];
  return Object.freeze([
    definition('minimal.intake-ledger', stalenessBound, all, {
      'intake-receipt': fold('set-union', 'rawHash', 'adapter'),
      'intake-resolved': fold('set-union', 'logicalId', 'principalId'),
      'intake-admitted': fold('exclusive-singleton', 'logicalId', 'receipt'),
      'intake-held': fold('set-union', 'logicalId', 'reason'),
      'intake-expired': fold('set-union', 'hold', 'terminal'),
      'intake-collapse': fold('set-union', 'logicalId', 'original'),
      'intake-mismatch': fold('set-union', 'logicalId', 'original'),
      'intake-stop': fold('set-union', 'logicalId', 'principalId'),
      'intake-stop-signal': fold('set-union', 'logicalId', 'principalId'),
    }, 'Not receipt, dedup or admission state.'),

    definition('minimal.principal-binding', stalenessBound, all, {
      'genesis-grant': fold('set-union', 'grantId', 'principalId'),
      'conversation-binding': fold('exclusive-singleton', 'channel', 'principalId'),
      'intake-resolved': fold('set-union', 'logicalId', 'binding'),
      'intake-stop': fold('set-union', 'logicalId', 'binding'),
    }, 'Carries no grant, revocation, identity evidence or binding selection.'),

    definition('minimal.run-view', stalenessBound, all, {
      'slice-obligation': fold('exclusive-singleton', 'blocker', 'state'),
      'intake-admitted': fold('set-union', 'logicalId', 'receipt'),
      'intake-stop': fold('set-union', 'logicalId', 'scope'),
    }, 'Not an open minimal-plane assignment, blocker, stop or recovery fact.'),

    definition('minimal.outbound-obligation', stalenessBound, all, {
      'slice-obligation': fold('exclusive-singleton', 'operation', 'state'),
      'slice-delivery-evidence': fold('set-union', 'operation', 'stage'),
      'slice-reply-source': fold('set-union', 'semanticMessage', 'basis'),
    }, 'Not an outbound operation, settlement or delivery-evidence record.'),

    definition('minimal.authority-queue', stalenessBound, all, {
      'intake-held': fold('set-union', 'logicalId', 'reason'),
      'conversation-binding': fold('set-union', 'channel', 'principalId'),
      'slice-obligation': fold('set-union', 'operation', 'owner'),
    }, 'Not an authorization request or disposition. The full authority queue of section 2 is outside this brief and confers no authority here.'),

    definition('minimal.guard-repair', stalenessBound, all, {
      'slice-obligation': fold('set-union', 'operation', 'owner'),
      'slice-delivery-evidence': fold('set-union', 'operation', 'decisive'),
      'intake-expired': fold('set-union', 'hold', 'terminal'),
      'intake-held': fold('set-union', 'logicalId', 'owner'),
    }, 'Not a required holder observation, source-availability report or owned repair obligation.'),
  ]);
}

export const minimalPlaneProjectionIds = Object.freeze(['minimal.intake-ledger', 'minimal.principal-binding',
  'minimal.run-view', 'minimal.outbound-obligation', 'minimal.authority-queue', 'minimal.guard-repair']);
