# Change review — Acknowledgement waits through answer review

Subject base: 7db7ba5c60b3fd2f732e5f4b9d7ff053e327dd13
Review state: open
Reviewed content: none
Outcome: At ten seconds, an eligible intake gets one acknowledgement while its answer is still in review; dispatching the final answer cancels an unadmitted acknowledgement and waits for an already dispatched one.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/26/32/36/49/52/63/70/74/77/87/101/102/111/113/116.
Affected floors: secrets — existing outbound and audience checks; spend cap — no new model calls, existing reply allowance; stop — current and send admission rechecks retained; no duplicate sends — one timer, existing signed intents and UNKNOWN fences; durable intake — unchanged journal intake and historical replay.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Small fix to timing at the irreversible reply doorway.
Side effects: An answer ready before ten seconds can now acknowledge during slow review. Final delivery still waits for an acknowledgement already dispatched. No prompt, parser, model acceptance or reply review decision changes. Historical eight-second intents remain readable.
Undo and recovery: Revert worker timing changes if needed, but retain the widened journal fold so acknowledgements recorded after answer readiness remain readable. Never repeat accepted or UNKNOWN sends.
Multi-machine posture: Existing timer is process-local over durable intake; ownership, disclosure, replication and signed send admission remain authoritative. No new shared state or authority. Restart reconstruction eligibility is unchanged.
Layer below: Read both constitutional documents fully and verified they match origin/main. Inspected journal fold, timer current recheck, final push admission and acknowledgement-in-flight ordering. An answer record is not evidence of dispatch; turn.intent remains the durable dispatch fence.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Decision: holdack5-dispatch-cutoff | Remove answer-readiness suppression from the existing timer and fold; cancel at final dispatch and wait for any dispatched acknowledgement. No new timer, message type or durable state. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack5-1012-PROGRESS.md
Decision: holdack5-recorded-timing | Replay the brief's 969390429 and 969390426 timings using committed 969390408 answer/reviewer bytes, explicitly distinguish timing provenance from byte provenance, and retain existing captured uncertain/empty shape tests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack5-1012-PROGRESS.md
Decision: holdack5-peer-recovery | Update the two-machine peer-loss expectation: an acknowledgement delayed by replication can precede the reviewed answer after recovery. Studio must verify this host-dependent case. The 0/8200/10200 launcher fixture needs no expectation change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack5-1012-PROGRESS.md
Prompt review: No model-facing prompt, parsing or accept/escalate/refuse criteria changed. Existing captured shape tests exercise the same acknowledgement path. Report names the original capture update ids. New tests inject reported timing sequences rather than claiming inaccessible live journals were read.
Prompt finding: 849db3a6296a | protocol-literal | Existing answer protocol literal unchanged; not a new semantic classification.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing regression removes a recall instruction as a negative control; no prompt changes here.

Deferral: generated/register.json:1 | not-a-deferral=Existing governed text emitted by the register generator; no deferred work.

## Closing block

simplestRobustRoute: This is the simplest robust route: remove the premature readiness cutoffs and reuse the existing dispatch cancellation and in-flight join. The journal already refuses acknowledgements after a final intent. Keep the ten-second timer, audience/secret/stop/cap guards and historical replay. No new machinery or unattended production completion claim.
80/20: Fail-before/pass-after timing replay and targeted direct-import checks, compiler and required architecture/register gates. No full suite, load generation or live messaging. Studio-only checks are named for the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
