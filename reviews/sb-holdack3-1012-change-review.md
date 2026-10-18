# Change review — Integrate the reviewed acknowledgement timer

Subject base: 4b125fec868204430f25023b94d0cf071e0c867d
Review state: open
Reviewed content: none
Outcome: Integrate holdack3-1012 at 5f256a10 onto the exact live head, preserving its reviewed fixed acknowledgement, independent durable intake timers and serial answers.
Affected rules: Purpose least revelation and durable cause; Rules 1/4/14/28/32/36/41/45/46/49/52/55/58/60/63/69/70/74/75/77/87/89/90/101/102/111/112/113/116.
Affected floors: secrets — same outbound and custody checks; spend cap — no added paid call and reply allowance retained; stop — same admission and last physical checks; no duplicate sends — durable signed intent and UNKNOWN fence retained; durable intake — journal acceptance remains before timer and answer work.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integration of user-visible asynchronous acknowledgement dispatch and restart recovery.
Side effects: Inherited reviewed timer can overlap disclosure or peer admission and is rechecked before physical dispatch. Paid answer calls remain serial. Legacy reviewed acknowledgement rows remain readable. Publication identity changes after register replay; no source or fixture bytes are edited by this build.
Undo and recovery: Return to the previous reviewed source and regenerate publication, retaining support for new fixed acknowledgement intents in any root that has used them. Never repeat an accepted or UNKNOWN send.
Multi-machine posture: Timers are deliberately process-local and reconstructed from durable intake; signed intents, ownership fences and existing replication admission govern dispatch on all machines. No new shared store or authority.
Layer below: Exact live base 4b125fec and unit 5f256a10 share ancestry; ordinary merge fast-forwarded without conflicts. Inspected timer cancellation, restart rearming, durable admission and physical-send rechecks. Desk chain found zero stale inventory or owner pins and replayed 289 entries and 116 rules from 5f256a10. Unit evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack3-1012-PROGRESS.md; this build independently runs available targeted replays and leaves platform-bound evidence explicit.
Bug class: integration
Bug evidence: reproducer=tests/preview/reply-acknowledgement-timing.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples.
Convergence: none
Decision: sb-holdack3-merge | Ordinary merge of reviewed 5f256a10 into exact live 4b125fec fast-forwarded with no conflicts; preserve unit source and reviews unchanged. Unit report: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/holdack3-1012-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack3-1012-PROGRESS.md
Decision: sb-holdack3-publication | Run the required existing desk repin, build, owner rehash and register replay; zero source pins change, and generated publication records merged 5f256a10. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack3-1012-PROGRESS.md
Prompt review: No new model-facing text added by integration. The unit removes per-send fixed acknowledgement review; its fixed Checking that now. template carries no private content or result claim. Existing recorded live outputs 969390407–410 and seven summary/Jev/review/delivery shapes traverse the new path; exact source and fixtures retained.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged answer literal, already dispositioned in the unit part1 record.
Prompt finding: bd01de21286a | protocol-literal | Existing unchanged memory-grounding guidance, already dispositioned in the unit part1 record.
Prompt finding: fb5fa7e706c8 | protocol-literal | Existing unchanged memory-grounding guidance, already dispositioned in the unit part1 record.
Deferral: generated/register.json:1 | not-a-deferral=Existing governed register text emitted by the generator, not deferred work.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the reviewed unit, unchanged runtime bytes, and the existing desk publication tools. No new runtime or process machinery. Existing timer, current-eligibility checks, send admission and durable UNKNOWN fencing supply the start, completion and resource guards. Tests replay recorded outputs; no new live deployment or unattended production completion is claimed.
80/20: Target the changed tests, recorded shapes, default context floor and required machine checks. WSL platform limitations remain explicitly reported for the Studio gate; no full suite or load generation.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
