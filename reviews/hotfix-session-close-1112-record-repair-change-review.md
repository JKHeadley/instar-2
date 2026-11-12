# Change review — scrub exit diagnostics and renew native conformance

Subject base: 8ff2f5f97afe005e91183cb1e5764b9a1a8957f9
Review state: open
Reviewed content: none
Outcome: Close the diagnostic credential leak by scrubbing the entire assembled DIAG-EXIT output; renew native conformance from the existing real contract workflow and refresh derived register pins.
Affected rules: 1, 4, 24, 34, 37, 49, 70, 74, 101, 102, 105, 111, 113, 115, 116, 123
Affected floors: secrets — the existing redactor now covers name and stack as well as message; spend cap — no admission or accounting changes; stop — no lifecycle changes; no duplicate sends — no dispatch changes; durable intake — no intake or persistence changes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The repair closes a demonstrated credential leak on the shipped runner's stderr and restores byte-bound native contract evidence.
Side effects: Credential-shaped text in error names and stack frames is replaced by the existing redaction marker. Useful nonsecret context, the existing first-message-line 300-character bound, eight stack-line bound, exit status and fallback message remain. A redaction exception suppresses the diagnostic through the existing catch. The prior record's claim that restricted stderr preserved the secrets floor was incorrect: ordinary multiline Error messages leaked through the stack. This repair supersedes that claim without weakening diagnostic or agent capabilities.
Undo and recovery: Reverting this repair reopens the leak and invalidates conformance; prefer a forward repair. If reverting composition bytes, rerun the native contract and mechanically renew conformance and register pins for those bytes. No live restart, journal mutation or production test identity is introduced.
Multi-machine posture: Diagnostic output remains machine-local on each runner's existing operator stderr surface. No shared state, ownership, placement or replication changes.
Layer below: Read src/recall/redact.ts credential patterns and fail-closed secretShape fallback; executed the actual final catch extracted from journal-agent.mjs with the real redactor. Read compositionClosure/compositionDigest derivation and the existing native renewal workflow, which requires the declared Darwin runtime, a passing contract except the stale certificate before renewal, and all ten tests passing afterward or restores the declaration.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-agent-exit.test.ts
Hook bypass: none
Convergence: none
Decision: D01 | Keep the existing diagnostic and apply redaction to its entire assembled output before stderr, retaining the inner message scrub before truncation to avoid leaking a truncated credential. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-record-repair-PROGRESS.md
Decision: D02 | Use the existing evidence-gated native renewal workflow and delegated desk rehash/replay tools, never hand-edit conformance or owner pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-record-repair-PROGRESS.md
Prompt review: No prompts, model parsers or model accept/escalate/refuse decisions change. Tests execute an infrastructure error path; observer #106 recorded model-shape replay is inapplicable.

1.x comparison: Inherit the reviewed search at JKHeadley/instar origin/main 72dfe3a52b8cfe7a2ebed131b7acfc332f4c02f0: src/core/SqliteRegistry.ts (history ab26b7ca3), docs/specs/MULTI-MACHINE-LEASE-ROBUSTNESS-SPEC.md and REMOTE-SESSION-CLOSE-SPEC.md, ONEX-LESSONS.md sections 2/6. Idempotent cleanup fits; broad SQLite shutdown catches do not replace journal-edge accounting. For this repair searched actual local origin/main 700b2a9135623f5eae27ebcf5352d9a6d9135c1b src/core/SecretRedactor.ts, src/security/, docs/specs/ and history (ab26b7ca3); read SecretRedactor.redact and APPRENTICESHIP-STEP0-RETRO-HARVEST-SPEC.md section 7 plus ONEX sections 2/6. Reuse whole-output scrubbing before emission through existing 2.0 src/recall/redact.ts. 1.x reversible redaction maps/entropy machinery does not fit this diagnostic; no unrelated code is copied.

Team posture: Same local operator diagnostic audience and access as before; credentials excluded regardless of audience. No owner/member/guest grants, sharing or authorization changes. Fixture credentials are synthetic and isolated from live stores.

Evidence and limits: Both diagnostic tests fail on the reviewed code and pass on the repair: ordinary multiline Error message repeats a synthetic credential through stack lines; a credential-bearing name is independently scrubbed; harmless error message and frame context survive. Native and final gate outputs are recorded in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/hotfix-session-close-1112-record-repair-PROGRESS.md. Full tests remain with the pipeline under the operator's specific direction. This does not establish the cause of the live lost journal edge or reconcile unknown/already-closed histories; session-close-tolerant-1112 remains the repair owner, with Rule 33 in its constraint assessment. The existing close regression and mitigation remain unchanged.

## Closing block

simplestRobustRoute: This is the simplest robust route: scrub at the existing stderr boundary and renew the current native composition through existing contract evidence. Entry is the existing runner error catch; completion is useful credential-free diagnostics and a verified current declaration. Existing spend, stop, duplicate-send and durable-intake checkpoints remain intact. No added framework or autonomous root-cause completion claim.
80/20: Two focused red/green tests cover the leak and useful neighbors; the existing native contract verifies the declaration. Product repair is two changed lines; additional files are test, evidence review and mechanically derived governance artifacts.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
