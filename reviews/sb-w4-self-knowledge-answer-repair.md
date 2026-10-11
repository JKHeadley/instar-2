# Change review — Fit contextual reply review to its existing output cap

Subject base: 95f06b7d1393aa1d7d05d842c3a8312b362b0cec
Review state: open
Reviewed content: none
Outcome: A group reply's contextual review can complete within the existing 2048-token ceiling instead of replacing a valid answer with a holding notice after an output overrun. Request a compact reasoning summary and a 1500-token complete response, including on the existing format re-ask.
Affected rules: 36, 37, 41, 49, 57, 58, 70, 74, 75, 77, 95, 101, 102, 112, 113, 116
Affected floors: secrets — exact wall and contextual disclosure review retained; spend cap — unchanged token, call and resource ceilings; stop — unchanged; no duplicate sends — unchanged journal reservation and receipt path, replay delivers once; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: This changes the explanation requested from a live reviewer; actual recorded input is replayed with the real model, followed by the worker path. No rule selection, evidence, verdict parser, authority, tool access or retry policy changes.
Side effects: Review reasoning is requested in at most two short sentences, with findings still recorded separately for every selected rule. This may reduce explanatory detail; rule meanings, each reason's 300-character request and 600-character parser tolerance remain unchanged. Prompt digests change; historical records retain their original bytes.
Undo and recovery: Revert the source, fixture, test and review in a new commit, then regenerate the register from the restored source. No journal migration or live-root edit is required.
Multi-machine posture: Same prompt on every machine; no new state, ownership, lease, replication or cross-machine communication. Offline replay journals and desk evidence are deliberately machine-local.
Layer below: Inspected the physical provider's 2048-token refusal, the recorded output-cap outcome, invokeSubscription's uncertain mapping, full-context rule selection, the shared-audience hold, the one bounded revision and its review, and the journal's one-send receipt. The group disclosure checkpoint remains closed on unavailable review.
Register publication: Rebuilt generated/ from source commit 5de41bab7ac7003f0a079baa7210f505a02526aa using build-register --replay. The delegated owner-manifest and inventory-chain repin tools found zero stale pins; no pins were hand-edited. This record covers the mechanical publication commit as well.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-review-output-budget.test.ts
Hook bypass: none
Convergence: none
Decision: review-output-fit | Bound the explanation requested through the existing prompt, retaining every question and full context. The original five-rule review consumed 2638 tokens; increasing caps or adding retries is unnecessary when the same recorded context completes under current bounds. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-self-knowledge-repair-PROGRESS.md
Prompt review: Reviewed the changed reviewer question and format reminder for Rules 12/27. Neither names fixture phrases, prescribes a verdict, drops a rule, or embeds an expected answer. Both request compact explanation only. Replayed the actual update 715675418 review envelope with the final prompt; retained adverse findings as well as passes and drove the existing correction path. Recorded historical summary, uncertain, Jev undecided/unsure, review, sensitive-disclosure, delivered and empty-context shapes are replayed separately.
Deferral: tests/preview/fixtures/reply-review-output-budget-2026-10-10.json:105 | not-a-deferral=Verbatim recorded reviewer output describing a deferral in the candidate reply. Historical evidence, not a commitment by this change.
Deferral: tests/preview/fixtures/reply-review-output-budget-2026-10-10.json:153 | not-a-deferral=Verbatim recorded reviewer output deciding whether future-action language is present. Historical evidence, not a promise to do later work.
Deferral: tests/preview/fixtures/reply-review-output-budget-2026-10-10.json:190 | not-a-deferral=Verbatim model correction reasoning about removing the original status handoff. The recorded correction is completed in this fixture.
Validation: Five focused regression cases pass, including original uncertain hold and two one-send completion paths. Final-prompt real model outputs: selected review 537 tokens, all 13 rules 676, correction 873, correction review 229. The selected review/correction/review took 24822 ms total, below the existing 60000 ms allowance. The existing context-floor measurement passes unchanged. TypeScript and build pass. Architecture passes. The register publication is refreshed mechanically after the source commit. All eleven contract checkers were invoked; the specified saved report is absent, so each reports ENOENT for .test-results.json. No new full suite or live Telegram send is claimed; the pipeline performs those checks after push.

## Closing block

simplestRobustRoute: Reuse the existing reviewer with an output request that fits its actual allowance. The named failure is the live 2638-token review being discarded at 2048 tokens, which correctly activates the group disclosure hold. No machinery is added. Start guard: the full recorded context and all selected rules reach review. Limit guards: token, byte, call and shared time bounds stay fixed; uncertain review still holds group disclosure. End state: a complete review, or the existing bounded correction plus review, releases exactly one answer through the normal worker. Actual model reruns and offline worker delivery are recorded; unattended live-surface acceptance belongs to the pipeline answer check, not this author claim.
80/20: One prompt producer and its existing re-ask change; one focused fixture and test preserve the live failure and demonstrate both sides. No quarantine, broader refactor or new capability restriction.
VERDICT: author submission; no independent pass is recorded for this record
