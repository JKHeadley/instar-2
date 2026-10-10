# Change review — detect loss of media causal admission records

Subject base: 94e51243d0af3fdf518dfe475186a0eee557f005
Review state: open
Reviewed content: none
Outcome: The shipped media-custody agreement detects missing or altered source-bound claim records after successful, failed or interrupted downloads. The journal retains the exact claim fingerprint before dispatch and refuses recreating a prior attempt after claim-file loss.
Affected rules: 1, 7, 14, 26, 32, 33, 34, 37, 44, 45, 46, 49, 60, 63, 70, 74, 77, 95, 101, 102, 111, 113, 116
Affected floors: secrets — only an opaque SHA-256 fingerprint enters the encrypted journal, no token or downloaded bytes enter diagnostics; spend cap — no new paid calls, answer reservations unchanged; stop — existing stop/owner/policy checks remain at both request boundaries; no duplicate sends — reply path unchanged, retained journal attempt prevents another fetch even after claim file loss; durable intake — original intake and expected evidence survive failed custody
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: A local durability defect in the causal evidence for an authenticated physical request; the repair touches its checkpoint and shipped agreement consumer, without widening authority.
Side effects: Adds one small media-claim frame and optional per-turn mediaClaim fingerprint. The exact consumed prefix is recorded durably before the first request; the admission checks the retained attempt before writing another claim. Fingerprints survive ordinary journal snapshot/restore. The existing hourly agreement compares source-derived claim paths and raw retained bytes, counts unavailable evidence separately, and remains observational. No model prompt, output parser, provider, notification route, service or poller changes. Store declaration and generated register evidence are refreshed with the delegated desk scripts.
Undo and recovery: Keep all journal, media and media-claims bytes. Roll forward with this reader; older readers that do not know the non-additive media-claim frame must not resume these roots. Do not remove an expectation to retry an uncertain request or rebuild lost claims from memory. Existing complete encrypted bytes are reused; lost incomplete attempts retain the ordinary answer path. Legacy stored outcomes without a fingerprint are unmeasurable, never claimed as verified; no fabricated backfill.
Multi-machine posture: Claim files and encrypted attachments remain machine-local, deliberately. The small journal expectation follows existing journal replication and compaction; another machine reports missing local causal evidence rather than recreating it. Existing owner/stop fencing remains. No independent key custody or new claim replication is claimed.
Layer below: Six consumes a durably written signed prefix before retainClaim; transport-file-storage uses atomic rename and fsync; the journal append precedes both physical requests; snapshotOf retains the per-turn fingerprint; check-agreements uses the same STORE_AGREEMENTS input as runtime proofs. The restart test deletes local claims and proves the consumed expectation prevents recreating evidence and reissuing the fetch.
Bug class: unit
Bug evidence: reproducer=tests/preview/telegram-media.test.ts
Hook bypass: none
Convergence: none
Decision: media2-mf2-journal-anchor | Retain a source-bound consumed-prefix fingerprint before physical dispatch and consult the journal prior attempt before creating claims; loss cannot erase expectation or permit reconstruction and repeat. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-media2-repair-041207-PROGRESS.md
Decision: media2-mf2-existing-agreement | Extend the existing hourly and command-line media-custody check; compare actual bytes, preserve separate missing-media and causal-evidence counts, and report legacy expectations as unmeasurable. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-media2-repair-041207-PROGRESS.md
Decision: media2-mf2-rollback | The media-claim frame is non-additive because an older writer must not silently discard the no-repeat expectation; generation advances to 2 and recovery preserves the journal. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-media2-repair-041207-PROGRESS.md
Prompt review: No prompt, output parser or model judgment policy changes. Existing recorded-output replays remain exercised: reply/Jev unsure and unavailable subscription verdict at 969389800; summary writer and uncertain shapes at 715672484/492/496/497; delivered reply 715672479 and empty recorded context reply 715672550. The new claim fingerprint is not added to model text. Media envelopes and HTTP bodies remain explicitly synthetic; no live Telegram or fresh provider proof is claimed.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal prompt guidance or fixed response; this repair changes only media claim recording and leaves that prompt text untouched.
Prompt finding: bd01de21286a | protocol-literal | Existing journal prompt guidance or fixed response; this repair changes only media claim recording and leaves that prompt text untouched.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing journal prompt guidance or fixed response; this repair changes only media claim recording and leaves that prompt text untouched.

Subject (10 paths): register-source/owner-references/preview.json, scripts/transport-file-storage.declarations.json, tests/preview/held-cascade-replay.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal.ts, tests/preview/media-admission.ts, tests/preview/store-agreements.test.ts, tests/preview/store-agreements.ts, tests/preview/summary-cascade-stall.test.ts, tests/preview/telegram-media.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: use the existing encrypted journal to retain one source-bound expectation before dispatch, and extend the existing media agreement to compare actual claim bytes. A post-download marker alone misses crashes; checking only file presence accepts substituted records; rebuilding a lost deterministic ledger hides the loss. The journal prior-attempt check prevents that concrete failure. Start guard is existing admission plus retained attempt; end state is a durably checked agreement through the shipped command; limits remain two bounded requests and the existing stop/caps. The unattended physical consumer tests cover intact, lost, corrupt, interrupted, compacted and resumed cases with no live provider claim.
80/20: MF2 is covered at its source and consumer with existing mechanisms and focused tests. No new watcher, service, generic ledger framework or broad intake gate. Independent review and full gate run remain desk-owned; this is an author submission.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
