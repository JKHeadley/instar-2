# Change review — Complete explicitly requested verification steps

Subject base: 1eba461d887b74f8a3eecd7f11d9de0a0de9962b
Review state: open
Reviewed content: none
Outcome: Complete explicitly requested verification before answering, even when a previous tool result already describes the expected state.
Affected rules: 12, 20, 23, 26, 30, 36, 49, 58, 70, 74, 84, 101, 111, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake keep their existing checkpoints; full tool availability and effect admission remain unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Shared model-facing tool guidance changes on all three tool routes and its generated register is refreshed; verify real recorded failures and fresh model outcomes.
Side effects: May perform an explicitly requested check that cached context previously caused the model to omit. Uses the same bounded allowance. Text-only review cannot execute missing work, so prevention belongs in the writer tool framing. Existing parser and review decisions are unchanged. Historical prompt captures remain immutable; tests account explicitly for this new guidance.
Undo and recovery: Revert this guidance and associated regression updates through the normal release process. No schema or durable state migration. Do not repeat uncertain effects during rollback.
Multi-machine posture: Pure shared prompt composition ships on each machine. Existing conversation ownership, machine-local tool workspaces and durable trace recording remain unchanged; no new store or distributed coordination.
Layer below: Read candidate update 715676307 reasoning and admission evidence, live update 46040062, the shared framing consumers, reply-review correction path, and T.sh admission assertions. Fresh test uses real harness identity, isolation, sandbox, admission, budget reservation and resource owner. Fixed obsolete HARNESS_LOGIN import in the opt-in replay test, which otherwise generated an invalid r:undefined probe.
Bug class: user-facing
Bug evidence: reproducer=tests/preview/fixtures/tool-verification-2026-10-15.json; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-41-repair-evidence/final-live/requested-verification.json
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks, checked before commit.
Convergence: none
Prompt review: General completion guidance, no fixture filename, quoted task text, byte count or harness-specific action sequence in the product instruction. Real failing and passing recorded turns plus fresh model replay cover the requested check and the no-tools neighbor. The historical uncertain summary, Jev unsure/undecided, reply-review and delivered/empty replies are replayed unchanged. No new block or authority. Full suite and macOS R105 byte-bound recertification remain desk-owned under the explicit repair charter.
Prompt finding: 034c5250da92 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 0abb3dc96311 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 42faf877ba82 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 4b98dc2a1b9f | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 5b486d8bd247 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 5fa1a20c4031 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 6af48f94b789 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 7c45ffbe90ad | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: 95e349aaf4ac | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: aef7d91bef51 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: b00ed403060a | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: b1bb3946362d | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: b288d6ef1604 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: e769ca9dd959 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: f6d7f3274c85 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.
Prompt finding: feadb66b8ad1 | protocol-literal | Historical capture comparison binds existing identity, authority and review-protocol wording; it is not a trigger used to decide the operator request.

Register replay: Standard desk rehash and repin scripts changed no owner or inventory pins. Replayed seven generated artifacts from source commit a7b5338945db8bdbab94e3e2ae09e1a778d6bdee; no hand-edited pins.

Subject source paths: src/assembly/README.md, src/assembly/tool-answer-guidance.ts, tests/integration/act-first-live.test.ts, tests/preview/act-first.test.ts, tests/preview/fixtures/tool-verification-2026-10-15.json, tests/preview/selfdesc-abilities.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: supply the missing requested-verification distinction once in existing shared tool guidance. No new gate, retry or keyword policy. Admission, sandbox, cap, stop and durable cause still guard each effect. Fresh unattended scratch tool turn performed creation, actual read-back and byte count using the original recorded question; a separate no-tools request used no tools. This proves the repaired tool route, not Telegram deployment acceptance.
80/20: Fix the recorded omission at the writer source, replay real records, run only the three touched test files and tsc, then existing cheap gates. The pipeline owns the full-suite and pre-switch rerun.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own
