# Change review — report definite answer delivery failures

Subject base: 17dfeb44673820f6196086e9f62f7b12ccc56a14
Review state: open
Reviewed content: none
Outcome: A saved answer whose send is definitely refused now gets the existing durable one-time delivery notice. Uncertain sends retain uncertainty wording and neither original outcome is replayed.
Affected rules: Purpose 2/3 and least revelation; Rules 1, 26, 34, 36, 42, 49, 52, 55, 60, 63, 70, 74, 76, 77, 84, 87, 88, 89, 95, 101, 102, 111, 113, 116.
Affected floors: secrets — fixed content-free notice passes existing outbound checks; spend cap — no model call added and existing reply budget remains enforced; stop — existing stop and expiry admission unchanged; no duplicate sends — original intents never reset, existing proof-only bounded retry unchanged, notice has a durable separate identity; durable intake — original request and answer remain in the journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes a user-visible delivery-failure response on the irreversible send path, without changing transport or authority.
Side effects: Known refusals consume one additional notice slot, coalesced per conversation with other pending failures. Mixed uncertain/refused failures use uncertainty wording and retain each original outcome. Partial answers say the complete answer could not be sent. Notice failures do not recursively notify. A held or unstarted continuation remains ineligible. Historical unknown-notice rows replay unchanged; new readers also accept definite-failure wording under the existing delivery notice discriminator. The existing history projection exposes the notice alongside the original refusal without claiming the answer arrived.
Undo and recovery: Disable new emission while retaining the broadened reader if rollback is necessary. Do not roll a journal with new refusal-notice rows back to an older reader that rejects the wording, delete records or resend original intents. Deploy the matching reader to every owner before takeover.
Multi-machine posture: Reuses the existing replicated journal and owner-gated signed send path. No new store, lease, watcher or machine-local recovery state. Notices and answers keep separate durable identities across restart and handoff; neither an unknown send nor a terminal refusal gains retry authority.
Layer below: Inspected Telegram transport classification, proof-only two-attempt dispatch, durable outcome lookup, whole-answer split-part accounting, signed notice projection, stop/cap/expiry/audience admission and journal reopening. The effects reference slice's absence of general retry authority remains unchanged.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/delivery-failure-notice.test.ts; live=tests/preview/fixtures/deferral-send-failure-2026-10-08.json
Live evidence context: Replays the repository-captured answer for D1c update 46039703 against injected definite refusal and not-sent outcomes. The failure injection is synthetic; the answer is captured. No model instruction, parser, acceptance, escalation or refusal decision is changed, so no claim of new model conformance or live Telegram delivery is made. Studio proof-room acceptance remains required.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample files. Plain commits.
Convergence: none
Decision: delivery-fail-existing-slot | Extend the existing delivery notice slot to terminal refusals instead of adding a retry service, store or watcher; keep the historical discriminator for replay compatibility. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delivery-fail-1016-PROGRESS.md
Decision: delivery-fail-evidence-wording | Derive notice wording from retained whole-answer outcomes; all-refused batches state failure, mixed batches retain uncertainty, and original outcome records stay unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delivery-fail-1016-PROGRESS.md
Decision: delivery-fail-source-publication | Regenerate the existing shape-only register from the pushed product commit so source pins and capability briefing match; no policy or native certificate declaration changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/delivery-fail-1016-PROGRESS.md
Publication: Generated register outputs bind dd01dfd0ff09e27d80bcfc307660b5ebd3a66f4e through the existing replay generator; no native self-host certificate is changed.
Prompt review: Only fixed infrastructure notice wording and its eligibility change. Model instructions and semantic gates remain unchanged. Existing model-visible history already includes delivery notices and exact send outcomes. No fixture phrase drives a semantic decision.
Prompt finding: 4106b49fff07 | quoted-evidence | Unchanged instruction tested by the existing topic-awareness negative control; no new phrase matching.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged empty-memory response asserted by the existing memory-list test.
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged recall source instruction located by the hallucinated-memory negative control.
Verification: Six new tests failed before implementation because no failure notice existed. Targeted tests exercise known refusal, proven-not-sent exhaustion, unknown neighbors, burst aggregation, mixed outcomes, notice failure, restart, stop, expiry, caps, audience standing, split answers and operator views. Exact commands and host-dependent checks are recorded in the builder report.

simplestRobustRoute: This is the simplest robust route: extend the existing journal notice eligibility and select honest fixed wording from existing send outcomes. No new model, service, queue or timer. The named gap is silence after a definitely refused answer; the unknown-send notice path already supplies durability, coalescing and no-recursion behavior. Start guards remain ownership, disclosure, stop, expiry and reply caps; end evidence is a notice receipt or retained notice uncertainty/refusal. No autonomous live-completion claim is made.
80/20: Verify the changed outcome boundaries and direct consumers, then submit the pushed commit for independent Studio gate and proof-room acceptance. Preserve classified host limitations rather than treating offline tests as live proof.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
