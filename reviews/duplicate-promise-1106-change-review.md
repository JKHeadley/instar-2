# Change review — settle the reply promise when its answer is delivered

Subject base: 8258974660cadac50e9a4988c050cf14764e8dc3
Review state: open
Reviewed content: none
Outcome: a model-declared fulfillment closes an agent-owned reply promise whether captured by the answer, an open loop or a summary. Delivery of the request's result and fulfillment of its reply promise can settle together, leaving no duplicate owed result. Distinct promises stay owed unless explicitly fulfilled.
Affected rules: 4/10 semantic judgment; 8/83 owned follow-through; 26/36/70 evidence and recorded-shape provenance; 74/102/113 review and shared state; 101 no bypass; 116 reuse.
Affected floors: secrets, spend cap, stop, durable intake and no duplicate sends are unchanged. Closure still requires a complete accepted reply receipt, an exact delivered excerpt and no unfinished completion items.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: repairs the admission predicate for existing fulfillment claims without adding state, calls or authority.
Side effects: an agent-owned reply commitment lacking agentPromise can now be fulfilled explicitly. Operator-message commitments and unowned legacy notes remain ineligible. The same helper validates writer and replay, avoiding their historical divergence. No automatic same-turn, quote-similarity or report-text merge is introduced.
Undo and recovery: revert the predicate change. No schema migration is needed; closure uses existing durable answer, intent and receipt records. Previously recorded fulfillments for reply commitments become supported on replay; no new sends occur. New valid rows keep the existing wire format.
Multi-machine posture: the change is deterministic projection over the existing shared journal. Existing owner admission, durable effect intent, UNKNOWN-send binding and receipt checks are unchanged. No machine-local store is added.
Layer below: inspected journal obligation admission, summary commitment creation, packet offering, fulfillment parsing, intent filtering, settleDeliveredReply and obligationSchedule. Actual JKHeadley/instar main c55d2a998429cbb2a7f2d0748d015fc45415a2df was fetched and searched: src/monitoring/CommitmentTracker.ts record()/deliver(), docs/specs/COMMITMENTS-COHERENCE-SPEC.md duplicate section, docs/specs/PROMISE-BEACON-SPEC.md partial fulfillment, and tracker history including 4018bf338 and 5ff755994. ONEX-LESSONS.md commitment and outbound duplication entries were read. Reuse explicit agent semantic judgment and identity-bound delivery, not a heuristic merge. The 1.x externalKey dedup path does not fit independently extracted request and reply quotes with different identities; its standalone tracker/CAS service would duplicate the existing serialized journal.
Bug class: integration
Bug evidence: reproducer=tests/preview/duplicate-promise.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt wording changes. The existing instruction asks for fulfilled for completed open agent commitments, but the shared validator excluded reply commitments captured without agentPromise. The new predicate admits these through the same exact quote and receipt checks. The D1 fixture is built from the supplied replies/status at updates 46040849 and 46040850; it is a recorded-shape fixture, NOT a journal replay. Summary, work and fulfillment declarations are explicitly synthetic because original declarations were not supplied. Existing recorded-output tests also exercise uncertain summaries, Jev undecided/unsure, review output, empty bubbles and recorded fulfillment excerpts. No live D1c pass is claimed.
Decision: duplicate-promise-1106-reuse-fulfillment | Accept an explicitly owned reply commitment through the existing fulfillment path; preserve operator requests and unrelated promises instead of guessing semantic identity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/duplicate-promise-1106-r2-PROGRESS.md
Decision: duplicate-promise-1106-evidence | Preserve the supplied D1 status as historical failure and label constructed model declarations as stand-ins; live proof belongs to the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/duplicate-promise-1106-r2-PROGRESS.md

Verification: both summary and loop positive cases failed before the repair because the promise stayed open after the request closed. The new tests retain separate, UNKNOWN-send, omitted-declaration, invented-quote and unfinished-work neighbors; they reopen the encrypted journal and prohibit repeat work or sends. Existing assertions are unchanged. Targeted tests and gates are reported in the builder report.

Register publication: regenerated the seven existing generated register/capability artifacts from source commit f2bea3a7137bc3bd4dbad2b24a0a7d4253d4d0da. No declaration, manifest, grant or conformance certificate changed.

## Closing block

simplestRobustRoute: this is the simplest robust route: widen the existing shared predicate to the two existing agent-owned reply representations. The model identifies fulfillment, the existing parser checks offered identity and exact excerpt, intent retains evidence, and a complete receipt closes only work without open subtasks. No new store, model call, equivalence classifier or send path. Recorded-shape worker execution is not an unattended live-model proof.
80/20: one production predicate plus regression evidence; no unrelated cleanup or schema redesign.
VERDICT: author submission; independent desk review pending
