# Change review — train-199

Subject base: 8258974660cadac50e9a4988c050cf14764e8dc3
Review state: open
Reviewed content: none
Outcome: Integrate reviewed member local-verify-worker-1106 at 2af8dd7a25d67e36446db1911ec2b2e6d585386f on the accepted live base so a configured worker can request the existing verifier and read exact-head evidence; preserve the live base's behavior.
Affected rules: 1, 26, 34, 36, 37, 42, 60, 66, 69, 70, 74, 78, 84, 90, 100, 101, 102, 111, 113, 116
Affected floors: Secrets: existing SecretRef custody; spend cap and stop: existing MCP checkpoint; no duplicate sends: no send tool and existing effect preparation; durable intake: verifier queue unchanged. Integration adds no effects of its own.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The paths suggest critical because generated publication and the shared launch path are in the subject; declared to match, as train-176 did.
Side effects: Those of the member: a request can start the existing verifier and its already-authorized follow-on behavior; status reads are bounded point-in-time observations. The publication source pin moves to the member head. No prompt-bearing code changes; always-sent bytes measure 23166 under the unchanged 23459 guard.
Undo and recovery: Keep the live base serving until desk acceptance; revert the train if rejected. No live root, credential or runner is modified; no resend or state rewrite.
Multi-machine posture: Source publication travels by git. The configured verifier origin owns queue and execution as the member records; the client adds no store or local scheduler. Build evidence is machine-local deliberately; Studio owns the live, native and full-suite checks.
Layer below: Read the full constitution, the pinned member report and cint-L37 chain report, the member review and its diff to the two production consumers: tests/preview/harness-user.mjs (hook file list) and tests/preview/tool-turn.mjs (exact shipped-path launch rewrite). Direct importers of both were run on macOS.
1.x reference: Inherited unchanged from the member: JKHeadley/instar cedba8f3abb9e9619257394106952199f093702e; src/localVerify/localVerifyRoutes.ts, LocalVerifyService.ts, peer.ts, record.ts, statusProjection.ts and StatusReconciler.ts; docs/specs/local-verify-merge-authority.md section 2 and local-verify-capacity.md; history 8c2a16e67 and 2ae9dc186. Integration adds no behavior of its own to compare.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: No new model instruction or parser is authored by integration. The member's recorded summary, Jev, review and reply shapes replay in tests/preview/local-verify-worker.test.ts, which passes on this tree.

Subject (14 paths): docs/local-verify-worker.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, reviews/local-verify-worker-1106-change-review.md, tests/preview/fixtures/local-verify-unconfigured-1106.json, tests/preview/harness-user.mjs, tests/preview/local-verify-mcp.mjs, tests/preview/local-verify-worker.test.ts, tests/preview/tool-turn.mjs

Decision: train-199-member | Merge exact 2af8dd7a25d67e36446db1911ec2b2e6d585386f; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/local-verify-worker-1106-PROGRESS.md, verified snapshot sha256 ea8424fdcfc83ba21001168cb2b748116e0f6900304aa3f84b33793f99298750. It fast-forwarded because the member was built on this exact base, so its reviewed bytes land unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-199-PROGRESS.md
Decision: train-199-B | Create train-199 directly at exact 8258974660cadac50e9a4988c050cf14764e8dc3 in a separate checkout; never move the branch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-199-PROGRESS.md
Decision: train-199-C | No genuine product conflict; the one prescribed head is included and none is left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-199-PROGRESS.md
Decision: train-199-D | Host-bound failures in tests this train did not change are listed, not repaired: this Laptop has no _instarharness user and no local transcription model. Their assertions stay unchanged for the Studio gate. The whole-repository change-review check cannot finish here: this host's session watchdog interrupts any command past 180 seconds. This record was validated by the same validators scoped to it; the guard was not altered or evaded, and the full check stays with the Studio gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-199-PROGRESS.md
Decision: train-199-desk | Run repin, build, rehash and replay per /Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L37-PROGRESS.md, verified snapshot sha256 81a0412343bb17cff152cea467990b7966115a25fe4c25b583ff8b58346ba963. Repin and rehash changed 0 pins; replay moved the source pin to the member head. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-199-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: one ordinary exact-head merge plus the existing repin/build/rehash/replay chain. No new runtime mechanism. The five floors remain enforced. This candidate makes no live acceptance claim.
80/20: Run the member's changed tests and direct importers plus the named gates; disclose host-only checks and let the Studio run the full combined suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
