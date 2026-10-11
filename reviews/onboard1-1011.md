# Change review — Resumable terminal role onboarding

Subject base: f35057b932ed57d7d92bb341eb25278a9202ebc4
Review state: open
Reviewed content: none
Outcome: An installation owner runs instar2 setup, records role, starting trust, monthly spending choice and sensitive matters once through the existing standing-policy writer, resumes after interruption and receives an already-set-up result on repeat.
Affected rules: 1, 4, 18, 26, 28, 29, 32, 33, 34, 42, 44, 49, 60, 74, 80, 98, 101, 102, 103, 104, 111, 113, 116
Affected floors: secrets — no credential or subscription input; spend cap — monthly choice is separate from per-operation grants and grants no paid activation; stop — no stop state is read or changed; no duplicate sends — no send is dispatched, stable setup identity and no-replace grant publication; durable intake — each terminal answer is synced before the next question and completion checks the actual policy
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: User-facing installation entry and durable grant-policy metadata; no provider, model prompt, send, or runtime activation changes.
Side effects: Adds optional onboarding metadata to the existing policy decoder and retains it through grant revisions/revocation. Initial trust-file publication becomes atomic and idempotent. Existing role/effect classifications and legacy policies retain their behavior. Package gains a bin entry. Monthly amount records a choice, not a new meter or paid authority.
Undo and recovery: Revert this branch to remove the entry command; retain all owner input and policy files. Interrupted setup resumes only before its completion receipt; after completion a changed or revoked policy refuses reconstruction. Existing policies without onboarding remain unchanged. New-format policies need this decoder until the custodian explicitly archives onboarding metadata; do not point an old closed decoder at them or erase accepted answers.
Multi-machine posture: Deliberately installation-owner-local, matching the prior effect policy and MCP custody. A resumed directory keeps one id; this is not an enrollment or replicated identity implementation. Two installers publishing into the same local directory cannot replace each other's identity/answers. Runtime ownership and replication demands are untouched.
Layer below: Read configureTrust, setupTrustPolicy, setupMcp, decodeEffectPolicy, effect admission, the prior trust review, production installation and activation-authority records. The latter require independently admitted provider/channel/custody evidence absent in this slice; no fake activation is produced. Tests consume the real written policy and spawn the real package entry, including an exact-PID kill after two saved answers.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: onboard1-1011-D1 | Use the existing standing-policy writer for one role/grant-policy set; record literal role and trust without inferring connected-account scopes or manufacturing activation | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/onboard1-1011-PROGRESS.md
Decision: onboard1-1011-D2 | Publish immutable synced input checkpoints with no-replace links and verify real policy/MCP contents on completion; this prevents partial-file authority, duplicate identities and revoked-policy resurrection without a lock service | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/onboard1-1011-PROGRESS.md
Decision: onboard1-1011-D3 | Record monthly dollars separately from per-effect ceilings, keep identity/self-knowledge/reflection/growth on and preserve original onboarding metadata through later trust edits | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/onboard1-1011-PROGRESS.md
Prompt review: No model prompts, model output parsers or model acceptance decisions change. Terminal questions are explicit structured fields. Existing captured-model negative authority replays run in trust-setup.test.ts; the new feature's end-to-end evidence is a real spawned terminal command, not a mocked model or CLI.

Subject (9 paths): bin/instar2.mjs, docs/standing-trust-setup.md, package-lock.json, package.json, scripts/onboarding-state.mjs, scripts/onboarding.mjs, tests/preview/effect-doorway.mjs, tests/preview/onboarding.test.ts, tests/preview/trust-setup.mjs

## Closing block

simplestRobustRoute: This is the simplest robust route for the requested first slice: four terminal fields feed configureTrust, with durable answer checkpoints and atomic no-replace publication. Checkpoints prevent asking twice after interruption; atomic publication prevents a killed writer from exposing partial policy bytes; comparing the actual consumer state prevents a stale completion receipt from reviving revoked grants. Start guard is an empty or matching owner setup, end guard is decoded policy/MCP agreement, limits are bounded fields, no credentials and no paid activation. The real CLI runs unattended with scripted answers and an exact-PID interruption; this is evidence for role setup, not an active conversational installation.
80/20: Target the added test plus direct importers, typecheck, architecture, lint, register and change-review checks. No full suite or untouched-base worktree. Platform-only failures are named in the report and left to the desk's host; no independent convergence is claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
