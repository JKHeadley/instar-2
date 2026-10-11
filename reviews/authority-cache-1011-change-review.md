# Change review — reuse unchanged operator evidence during turn preparation

Subject base: e6e0aec7daa6169c3154e7917826a27732ecb2e2
Review state: open
Reviewed content: none
Outcome: The recorded accepted memory input reaches the model boundary without repeatedly reading and parsing the full operator message/provenance logs during packet fitting. Every authority lookup still resolves the current sealed grant with the current clock.
Affected rules: 1, 4, 13, 18, 26, 28, 29, 32, 34, 35, 36, 42, 46, 49, 57, 59, 70, 74, 77, 82, 94, 98, 101, 103, 104, 111, 113, 116
Affected floors: secrets — no additional disclosure or credential path; spend cap — existing call reservations and caps unchanged; stop — existing stop checks unchanged and preparation no longer repeats full-log parsing; no duplicate sends — send/receipt handling unchanged and copy replay refuses physical sends; durable intake — accepted input and journals retained, no migration or replay of an external effect
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: A small host-only performance repair on the live authority path; current revocation, expiry and authenticated provenance must remain enforced.
Side effects: Retains one parsed evidence object in process memory. Every lookup stats all three source files; inode/device, size, nanosecond mtime/ctime and mode changes invalidate it. A changed-during-read snapshot refuses and is not cached. Missing, malformed or unreadable evidence clears the snapshot and retains the existing null/refusal path. No authority verdict is cached. Continuous writes can still cause reparsing; the packet-fitting ladder itself is unchanged.
Undo and recovery: Revert this ordinary commit and restart the runner through the existing deployment path. No durable format changes or cache migration; restart drops the derived snapshot. The known preparation stall returns on rollback. Preserve accepted inputs and unknown effects; do not resend them.
Multi-machine posture: Deliberately process-local derived cache of the existing machine-local messaging-owner records. Each process observes its own files on every lookup. No change to authority ownership, grant replication, conversation ownership or peer requirements.
Layer below: Inspected requireAuthority, adoptTools/stillGranted, toolsActive, resolveActivationAuthority and the three-file operator evidence reader. Sealed grant bytes are reread on every check; expiry still uses the caller's current clock. JSONL parsing still checks every complete line and excludes only the trailing fragment. Existing tools-default launcher tests exercise live withdrawal. Q2 profiles and complete stage snapshots bind the pre-reservation stall to this reader.
Bug class: live-path
Bug evidence: reproducer=tests/preview/operator-records-cache.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/authority-cache-1011-evidence/stall.result.json
Hook bypass: none; core.hooksPath unset, common hooks directory checked and contains sample hooks only
Convergence: none
Decision: authority-cache-identity | Cache one parsed evidence snapshot keyed by directory and file identity, preserving the resolver and checking metadata on every lookup; ctime additionally detects same-size rewrites with restored mtime. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/authority-cache-1011-PROGRESS.md
Prompt review: No model instructions, model-output parsing, judgment routing or accept/escalate/refuse policy changes. Authority evidence parsing retains its prior semantics; only reuse of unchanged parsed bytes is new. The real recorded stall update 715675444 and preceding turns 715675441/442/443 were replayed through the changed full launcher, real resolver and fitting ladder. Physical Telegram/provider effects were blocked at their boundaries. No stub-only completion or fresh model-output claim.

Subject (2 paths): tests/preview/journal-agent.mjs, tests/preview/operator-records-cache.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse one parsed snapshot while every lookup checks all source identities and reruns the existing authority resolver. A turn-long unconditional snapshot would miss a provenance withdrawal; metadata invalidation prevents that failure. Restat after a read prevents caching a mixed concurrent snapshot. No TTL, watcher, authority-result cache or new service. Start guards are the exact live base and isolated copies; end guards are recorded-input model-boundary evidence and revocation/expiry neighbors; limit guards retain all existing effect/cap/stop doors. The unattended copied launcher reaches the blocked model boundary in 7.922 seconds with 1253 lookups, 1140 preparations and one parse; no claim of deployment or completed external reply.
80/20: Ten focused cache tests cover both reuse and invalidation; existing authority/launcher tests and required architecture/register/review/briefing checks are recorded in the desk PROGRESS report. The 15-second real-input copy bound passed; no Studio load generator, full suite or new production send was run. The pipeline owns broader testing and independent landing review.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
