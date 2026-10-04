# Change review — cint-L44 repair 3: the forwarded Host is bound to the admitted host; the native briefing and live scope case state the merged capability

Subject base: c7c9b1253fc1c6093fc665249c4b9aeb292a3aa1
Review state: open
Reviewed content: none
Outcome: Plan row #435, Astra round 3 VERDICT NO, two must-fixes. (1) tests/preview/egress-proxy.mjs admitted the request-line or CONNECT host and forwarded the caller's own Host header unchanged, so a shared server could route an admitted request to an ungranted or policy-sensitive virtual host while the journal named the granted one. The checkpoint now parses a present Host header with the same egressTarget rule and refuses (403, recorded deny, kind scope) any Host whose host or port differs from the admitted target, for plain HTTP and for requests inside CONNECT (one handler serves both); the forwarded Host is always set to the admitted authority, so an absent Host is supplied rather than left to the client library. The existing proxy test gains one case: write and read with a foreign Host over HTTPS and HTTP are refused and reach neither upstream; the matching-host neighbors (granted write with a case-different Host, reads with Host left to curl, over both schemes) reach the host; 11/11 pass. Public reads, git fetches and scoped writes are unchanged (the other 10 cases pass unchanged). (2) The native briefing still said "new and empty workspace" and "no network". It now states the retained conversation workspace (files stay for later turns), the shell's checkpoint network (public reads work; writes and local addresses refused), WebFetch as a GET of a public host, and the effect doorway for consequential effects, in the harness briefing's own wording. The gated live scope case now requires the public WebFetch to be admitted ("web read (GET) of a public host") and return 200 and the proxied public curl to exit 0, beside real denied neighbors: the outside-workspace Read, a WebFetch of a private address, a proxied curl to a private address and a direct connection that bypasses the checkpoint. The changed prompt bytes re-declare the self-host conformance digest in src/assembly/harness.declarations.json (native-harness-contract 9/9, native-loop 28/28). The live case was not re-run here (operator rule tonight: targeted tests only; a live run spends subscription turns); the recorded live-2026-10-03 fixtures are replayed unchanged by native-loop-replay.
Affected rules: 4 and 26 (an outward effect reaches only the host its decision admitted), 34 (the live proof requires the capability that exists, with a real refused neighbor on each side), 78 and 84 (the native agent is told its actual workspace and network capability), 37 (both fixed at source), 116 (one header comparison at the existing checkpoint; prompt reuses the harness wording), 74 (this record)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged (stop case untouched); no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the egress checkpoint is the network effect doorway's enforcement point and the native system prompt is model-facing.
Side effects: a client sending a Host that names a different host than its URL is now refused; nothing that addressed the host it named changes.
Undo and recovery: revert the repair commits.
Multi-machine posture: unchanged; the checkpoint is per tool turn and machine-local.
Layer below: egressTarget (tests/preview/tool-admission.mjs), the same host and port rule the request line is admitted by, parses the Host header; the forwarded request's dial address is the admitted target's resolved address, so Host was the only remaining unbound authority.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: cint-L44-repair3-host-bind | refuse a mismatched Host rather than silently rewriting it, and always forward the admitted authority: the refusal is recorded so the journal and the request agree; rewriting alone would hide the attempted target | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L44-PROGRESS.md
Prompt review: the native system prompt's tool sentence changes to state the retained workspace, checkpoint network and effect doorway; the conformance digest is re-declared; no new model-addressed answer rule.
Prompt finding: 450c79237a95 | protocol-literal | existing conversation-prompt wording carried unchanged into the native prompt by the one-sentence replacement; not new prompt text
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (12 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, src/assembly/harness.declarations.json, src/assembly/production-provider.ts, tests/integration/native-loop-live.test.ts, tests/preview/egress-proxy.mjs, tests/preview/egress-proxy.test.ts

## Closing block

simplestRobustRoute: one Host comparison at the existing checkpoint plus the admitted authority forwarded; the native prompt reuses the harness briefing's sentences.
80/20: 0 must-fix, 1 note: the gated live native case is updated but not re-run tonight (targeted tests only); the pipeline and desk own the live run.
VERDICT: author submission; the independent verdict is recorded as a pass
