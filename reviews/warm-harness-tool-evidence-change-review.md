# Change review — publish prepared tool evidence by operation

Subject base: 53d4659aeb920ca7dde039c662df8f2e4580ba8d
Review state: open
Reviewed content: none
Outcome: Completed prepared tool turns publish their admission evidence under the same operation-digest/attempt directory as cold turns. The unchanged Group T reader can verify their actual tool calls. Recovery publishes interrupted claimed turns through the same path.
Affected rules: 26, 36, 37, 39, 41, 45, 49, 60, 70, 74, 101, 111, 113, 116
Affected floors: secrets — custody, redaction and admission unchanged; spend cap — existing reservation and answer adoption unchanged; stop — existing cancellation unchanged; no duplicate sends — publication and recovery never rerun tools or sends; durable intake — reservation precedes invocation and interrupted evidence remains recoverable
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Repairs evidence discovery after tool execution without changing tool authority, model instructions, verdict parsing or effects.
Side effects: Only the runner-private directory is renamed, after checkpoint and socket closure and evidence reads. The harness state symlink retains its original target, so a running process and its admission hook never see a moved path. Existing bounded pruning removes the published directory and its linked harness state. An occupied destination preserves both records and leaves the reservation open.
Undo and recovery: Revert this source change to restore the former layout. Completed canonical directories remain readable by the existing cold-path consumer. A crash before publication uses the exact claim-bound speculative recovery; a crash after publication but before journaling uses canonical recovery. Missing, null or mismatched claims are not attributed to an operation. Nothing is dispatched again.
Multi-machine posture: Deliberately machine-local evidence and harness state. Existing conversation ownership and startup recovery remain responsible; no process, session or evidence directory is transferred between machines.
Layer below: Inspected prepareToolTurn state/private separation, egress checkpoint record paths and close, linked harness-state removal, open-reservation pruning and startup trace recovery. Tests verify checkpoint close still writes its original private path, retained hook state, both crash boundaries and cleanup after publication.
Bug class: integration
Bug evidence: reproducer=tests/preview/tool-prestart.test.ts
Hook bypass: none; checked core.hooksPath (unset) and the resolved common hooks directory (sample files only)
Convergence: none
Prompt review: No prompt, model-output parser or accept/escalate/refuse judgment changed. The new fixture contains exact admission bytes and the claim from proofroom3-ps-20261011-121754/tool-turns/next-6, update 840342333. No model output is synthesized as tool evidence.
Decision: evidence-path | Restore the established per-operation layout at completion instead of changing every reader or creating another index; the harness paths stay stable while active | reported=reviews/warm-harness-tool-evidence-change-review.md

## Closing block

simplestRobustRoute: This is the simplest robust route: one rename through existing completion and recovery restores the established evidence contract. The durable reservation and matching claim are the start guards; closed checkpoint/socket and retained actual admission records are the end guards; existing process/call/storage limits and bounded pruning remain. Exact recorded update 840342333 replay changes the unmodified Group T reader from zero directories/calls to one directory and three admitted calls, including the 25-byte result. This is captured-evidence replay, not a new live Telegram deployment claim.
80/20: All 16 tests in the touched test file pass, including the pinned real CLI's isolated cold/prepared replay. Against the old source, the two prepared publication cases fail while both cold neighbors pass. Typecheck, build and architecture pass. Final source pins, review and saved-report checks are recorded in the desk progress; the pipeline owns the full suite and live pre-switch rerun.
VERDICT: author submission; no independent verdict claimed
