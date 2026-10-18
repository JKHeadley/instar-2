# Change review — w4-shellnet repair round 2: a method override never downgrades a write

Subject base: 5a41631ec3c0d969c03a2784755f27a686e01f62
Review state: open
Reviewed content: none
Outcome: Unit review round 2 (Astra, VERDICT NO) reproduced one remaining must-fix: admitEgress let the first recognized method-override header replace the request line's method, so a POST carrying X-HTTP-Method-Override: GET, a DELETE carrying HEAD, or a GET carrying both a GET and a DELETE override was admitted as a read and forwarded unchanged. Fixed at its source: the checkpoint collects the request line's method and every method each override header names (comma-joined repeats split), and a request is a read only when every interpretation is GET or HEAD; a proven git fetch is admitted only when every interpretation is POST. Anything else goes to the effect doorway as a network write. This corrects the round-1 record's claim that deciding an override by the method it names keeps a write from becoming a read: that held only for overrides naming a write. Tests: the reviewer's three bypasses through the real proxy (upstream receives nothing) and in admitEgress, plus a comma-joined override, an empty override, and a read override on a proven fetch; plain GET, a read-only override on a HEAD, a POST override on a proven fetch and the genuine git clone still pass. Both new tests fail against the previous code; the reviewer's repro script now reports 403 for all three bypasses with only the ordinary GET reaching the upstream.
Affected rules: 1, 4 and 26 (a write cannot be admitted as a read at the checkpoint), 34 and 36 (both sides of the new decision tested through real curl, the real proxy and real git), 42 (refusals stay refusals)
Affected floors: secrets — unchanged; spend cap — unchanged (no model call); stop — unchanged; no duplicate sends — strengthened: a send carrying a read override is a network write for the doorway; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes which shell network requests the checkpoint forwards.
Side effects: a request whose request line or any override names a non-read method is now refused without tool:network-write, including one with an empty override value; reads, git clone and package installs are unchanged. No ability is removed: the decision is taken at the existing checkpoint.
Undo and recovery: revert these commits and this record; no journal frame or record row shape changed.
Multi-machine posture: machine-local, unchanged (one turn's checkpoint).
Layer below: admitEgress (changed); startEgressProxy forwarding (unchanged: it forwards the original method and headers, which is why every interpretation is checked).
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: shellnet-r2-override-every-interpretation | a request is a read only if the request line and every override-named method are reads; stripping overrides was rejected because a server honoring one is outside the checkpoint's view, and checking all interpretations is the smaller change | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-shellnet-s-PROGRESS.md
Prompt review: no model-facing change: no prompt, parser or model decision is touched; the change decides network requests. Recorded shapes replayed: the existing shellnet egress replay in tool-admission.test.ts reaches its recorded decisions unchanged.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/README.md, tests/preview/egress-proxy.test.ts, tests/preview/tool-admission.mjs, tests/preview/tool-admission.test.ts

## Closing block

simplestRobustRoute: keep the checkpoint and every ability; decide on every method the upstream could act on instead of the first override found. No new service, header stripping or network restriction.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass
