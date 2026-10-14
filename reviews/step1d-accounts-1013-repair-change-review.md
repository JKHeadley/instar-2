# Change review — current account-read policy and durable review recovery

Subject base: 9b5a3868f7f269e43eb8e014582622daab1ddaeb
Review state: open
Reviewed content: none
Outcome: Configured MCP reads recheck current host authority; completed after-send review findings survive a crash before coherence projection.
Affected rules: Rules 1, 2, 4, 18, 26, 32, 34, 36, 37, 41, 42, 49, 58, 63, 70, 74, 75, 77, 86, 96, 101, 102, 103, 104, 111, 113, 116.
Affected floors: secrets — existing held-material check and connector custody precede dispatch; spend cap — unchanged reservations, no recovery model calls; stop — existing claim/owner stop check; no duplicate sends — existing exact identity and intent, no recovery dispatch; durable intake — unchanged journal before model work.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs account authority enforcement and the durable consumer of model judgments, with executable-hook and encrypted-journal reopen regressions.
Side effects: Ordinary configured reads now cross the same host effect owner as other MCP calls and acquire its durable cause record. This adds a bounded local append, retaining ordinary repeat reads and the existing call ceiling. Unavailable host policy refuses them until policy can be read. Completed reviews retain their original verdict/reason; a lost escalation retains the known preliminary objection as advisory context, without dispatch or additional spend.
Undo and recovery: Revert this repair commit set to restore the reviewed head's behavior, which also restores its two known defects. No new journal record, format or migration is introduced. Existing generation-5 older-reader refusal and original-root rollback requirement remain. Interrupted paid work is never replayed.
Multi-machine posture: The existing owner-fenced host remains authoritative for its machine-local session admission. Reads use its current root account configuration and effect policy. Recovery projects existing durable journal results under the same single-owner worker. No new replica, cross-machine authority or state store.
Layer below: Inspected executable tool-admission-hook.mjs gate requests, createToolEffectOwner/createAdmissionGate held-secret and pre-dispatch append, current readRootMcp/admissionConfig host wiring, session connector custody, reply-check.ts terminal/escalation paths, journal reply-check projection, checkCoherence and probe context. Existing checkpoint, doorway and coherence mechanisms suffice.
Bug class: integration
Bug evidence: reproducer=tests/preview/session-admission.test.ts; reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; checked core.hooksPath (unset) and shared hooks (sample files only).
Convergence: none
Decision: step1d-repair-current-reads | Route every checkpointed MCP read with its exact input to the existing effect owner, which uses current account reads and policy; preserve ordinary reads with no new grant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1d-accounts-1013-repair-212342-PROGRESS.md
Decision: step1d-repair-review-recovery | Recover coherence from terminal durable review; only a missing required result becomes unavailable, carrying known objections without paid replay. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1d-accounts-1013-repair-212342-PROGRESS.md
Prompt review: No prompt or parser changes. The next-turn consumer now keeps the completed review instead of an invented interruption. Replay of archived reply-review 969389923 and Jev unsure 969389570 reaches recovery; recorded summary, uncertain, undecided and delivered/empty shapes retain their non-review distinction through the existing parsers.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed empty-memory reply asserted by the existing memory-list regression.
Prompt finding: e8708c7fea24 | quoted-evidence | Unchanged source-grounding instruction located by the existing hallucination regression; no literal classification added.
Subject: tests/preview/tool-admission.mjs, tests/preview/session-connectors.mjs, tests/preview/session-admission.test.ts, tests/preview/journal.ts, tests/preview/journal-conversation-session.test.ts, generated/{capabilities.json,capabilities.md,coverage.md,glossary.md,register.json,rules.md,source.json}.

simplestRobustRoute: This is the simplest robust route: send configured reads to the existing current-policy host checkpoint and rebuild the existing coherence projection from durable terminal review evidence. It closes stale authorization and lost-judgment failures without a new subsystem or capability restriction. Start guards are current account scope, policy and owner; end guards are durable cause and coherence; limit guards are existing secrets, caps, stop and exact duplicate protection. No unattended live deployment or copy-walk certification is claimed.
Verification: Focused executable-hook/custody/doorway suite passed 65 tests with two sandbox-dependent skips; final recovery expansion passed 27 tests. Baseline source with the new regressions failed five selected cases. Register replay generated from source commit 85efdfb2470d1e99eb729014048e9dbcdf2a1960; desk pin tools required no manifest or inventory changes.
80/20: Fix the two demonstrated source defects, prove positive and negative neighbors with the real executable hook and journal reopen, replay captured shapes, and run targeted/cheap gates. Studio owns full-suite acceptance.
VERDICT: author submission; no independent convergence or live deployment verdict claimed
