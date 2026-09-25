# Enforce lane repair boundary at 330097e

Status: STOP — owner decision required before changing the two inherited contracts.

## Findings

1. The lane adds seven partial holds on four distinct rules: 4, 14, 43, and 66. `buildRuleGraph` defines a gap as a rule with no edge and opens loops only for gaps or deferred edges. The normal workflow therefore has 112 gap loops, while the inherited `tests/e2e/register.test.ts` assertion expects 116. Changing that assertion to check the 112 gaps and the four named partial edges, or changing the rule graph's loop treatment, touches register-owned files outside this lane's reviewed scope. A count-only edit would weaken the assertion.
2. The lane adds partial holds to `src/rungraph/rungraph.declarations.json`. The inherited `tests/rungraph/closure-registration-additivity.test.ts` compares that entire file byte for byte with commit `3ded685bb0e4daa944cbe90e191d56d93ef54f70`. The bytes therefore cannot both contain the new holds and satisfy that contract. Removing the holds would discard reviewed enforcement evidence; changing the additivity contract or introducing an additive holder requires the Part Five owner's decision and, where applicable, protected register coordination.

## Decision needed

May the register owner update the normal-workflow contract to assert the four specific partial edges and 112 remaining gap loops, and may the Part Five owner approve a compatible additive registration or amend its original-installation byte contract? This lane will not alter those other-owner contracts on its own.

## Constitutional and scope trace

Rules 1, 3, 26, 37, 69 and 70 require the graph and its checks to describe actual evidence; Rules 4, 14, 43 and 66 are the four partial coverage subjects. Rule 8 requires uncovered work to remain visible. Rules 49, 74 and 111 require this scope conflict and its layer-below causes to be recorded. Rule 112 preserves the prior green additivity contract until its owner changes it. Rule 113 posture: this is repository/build evidence shared across machines; no runtime state or peer requirement changes. Rule 116 favors updating the two existing contracts through their owners over adding a parallel register or test bypass. The secrets, spend cap, stop, duplicate-send and durable-intake floors remain unchanged by this report.

Side effects and recovery: this report changes no runtime behavior or generated register. The lane's existing declarations and generated artifacts remain as at 330097e. No pin or register regeneration was performed.
