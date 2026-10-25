# Change review — train-157 summary floor repair

Subject base: 787047053b064ec028d15d873ab354676fee9b62
Review state: open
Reviewed content: none
Outcome: Restore the summary prompt's required maintenance margin at the existing minimum context limit.
Affected rules: Purpose 2 and 3; Rules 12, 26, 36, 37, 49, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: Secrets custody, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. Context bounds, output bounds and the 40-byte maintenance margin are unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: small
Tier rationale: Delete one redundant summary instruction, retaining its identical field requirement in the existing object schema. No logic, protocol, model routing or resource limit changes.
Side effects: Every rolling-summary question is 44 ASCII bytes shorter. The schema still explicitly places prose in the summary field; the following sentence retains the UTF-8 prose bound, and the complete JSON token cap remains. Prompt bytes and hashes change; captured outputs remain historical evidence, not a fresh model run.
Undo and recovery: Revert this one-line source edit if needed; this restores the measured floor regression and must be repaired before landing. No journal migration, resend, or state rewrite is needed.
Multi-machine posture: All hosts use the same shorter summary question. No new state, peer dependency, ownership change or host-specific branch.
Layer below: Read the complete constitution and inspect the summary object schema, question assembly, model envelope, reply-review reserve and measured floor guard. Reproduced 23436 summary bytes against a 23419 allowance; the answer was 23142 bytes and its review 29230. Keep both existing admission and maintenance boundaries rather than widening a cap or relaxing the assertion.
1.x comparison: Reuse the existing 2.0 summary and prompt-measurement paths; no new mechanism or 1.x transplant is needed for duplicate prose.
Bug class: integration
Bug evidence: reproducer=tests/preview/default-context-floor.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains sample hooks only.
Convergence: none
Decision: train-157-repair-summary-margin | Remove the redundant 44-byte field-location sentence because the summary schema already states it; preserve prompt caps, the servable floor, user/history headroom and both 40-byte maintenance guards. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-157-repair-165128-PROGRESS.md
Prompt review: The removed sentence only repeated the summary field location already specified by the JSON object. Retain all memory, uncertainty, provenance, UTF-8 and output-cap instructions. Replay recorded summary writer, Jev undecided, stronger review and uncertain/empty result shapes with existing tests. No new semantic keyword rule or canned answer is introduced.
Prompt finding: 4106b49fff07 | protocol-literal | Existing action-evidence boundary unchanged; truthful reporting assertion.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory status unchanged; fixed output assertion.
Prompt finding: 85544c20941f | protocol-literal | Existing retained-message waiting notice unchanged; output protocol literal.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel citation instruction unchanged; attribution assertion.
Validation: Targeted default-context-floor, default-root-conversation, summary-bound, summary-cascade-stall and memory-consistency tests; typecheck, architecture, lint, register check, change-review check and whitespace checks. Exact outcomes and host limitations are in the repair report.

simplestRobustRoute: This is the simplest robust route: delete one duplicate sentence and retain the schema that already gives the instruction. Start guard is the same admitted journal; end guard is the same bounded, reviewed summary; stop, spend and uniqueness remain untouched. Existing tests measure actual envelopes and exercise recorded outputs without adding machinery. No claim of live model or unattended user acceptance is made.
80/20: Repair the measured source of the failing assertion, verify the affected summary and floor paths, and submit the candidate to the Studio gate.
VERDICT: author submission; no independent verdict asserted
