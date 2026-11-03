# Change review — restore a full working session for Justin's live agent

Subject base: 99d890574a1731f5f4954e54ebe17f4702c781e4
Review state: frozen
Reviewed content: sha256:e982db1f73bb17a681f10117e41fe4237fb38c68f980ddb4802e9727fd1912fd
Outcome: charge real model calls against the existing journal spending cap instead of stopping each task after a small allowance; remove the extra per-task CPU, process, and file-handle ceilings; give admitted shell work a writable temporary directory, including tmux sockets; preserve the host-wide resource floor and the four-hour conversation deadline.
Affected rules: 1, 12, 27, 37, 48, 49, 60, 65, 70, 71, 74, 75, 101, 102, 107, 109, 111, 113, 114, 116
Affected floors: secrets — the existing admitted harness identity and secret custody stay in place; spend cap — each model call is durably charged before dispatch and the journal-wide cap is unchanged; stop — host-wide CPU/memory/process safety and the four-hour deadline remain; no duplicate sends — the delivery journal and Telegram receipt path are unchanged; durable intake — pending input and the saved working copy are retained across a switch.
Operator questions: none; Justin's standing instruction at topic 102965 message 121996 authorizes parity repairs without another approval, and Echo requested this specific limit repair at 15:09 PST. Live installation still requires a sealed, matching activation grant and a controlled switch.
Suggested tier: critical
Declared tier: critical
Tier rationale: changing model-call accounting and worker resource limits affects the live agent's ability to continue work and the spending boundary.
Side effects: conversation calls append one durable charge per dispatched call. An old fixed-charge conversation migrates only while idle. The process wrapper inherits operating-system CPU and file-handle limits instead of imposing smaller task ceilings; the host aggregate still caps memory at 18 GiB and processes at 288. Admitted shells use their own writable project scratch directory for ordinary files and tmux sockets. The register is regenerated for this source head.
Undo and recovery: retain the prior frozen build and switch back if the live probe fails. The existing journal and saved #2190 working copy are not rewritten by the source change. A failed charge append refuses dispatch rather than spending an unrecorded call.
Multi-machine posture: this candidate builds on the Studio and changes the installed Studio runner. Mama PC builders and unrelated agents do not inherit the altered task limits until they separately install this source.
Layer below: journal call append and projection, conversation host reservation, native Claude Code launch, OS resource wrapper, sandbox temporary-file creation, and the real Telegram task.
Bug class: unit
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts; other=tests/preview/journal-conversation-call-accounting.test.ts; tmux-scratch=tests/assembly/production-session-driver.test.ts; native-contract=tests/preview/native-harness-contract.test.ts (10/10 after the composition declaration refresh)
Hook bypass: none
Convergence: none
Prompt review: no new task instructions or model behavior prompt is added. The activation policy states that the journal cap charges calls individually.
Prompt finding: 4106b49fff07 | protocol-literal | Existing no-false-attempt instruction is unchanged; the awareness test checks that literal, not a new classifier.
Prompt finding: 85544c20941f | protocol-literal | Existing queued-message acknowledgement is unchanged; the session test checks its fixed wording.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-attribution instruction is unchanged; the recall test checks that it reaches the prompt.
Prompt finding: 0725f0150c56 | protocol-literal | Existing role and tool-refusal instruction is unchanged; the assembly test checks the fixed prompt contract.
Prompt finding: 27d7720e7977 | protocol-literal | Existing memory-record label is unchanged; the assembly test checks the fixed prompt contract.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory response is unchanged; the memory-list test checks its renderer.

Verification: typecheck, build, lint, and register check passed at source head 7b67acc98. The native harness contract passed 10/10. Focused conversation, journal, driver, and resource tests passed 528/529 before correcting one obsolete assertion that still expected a 128-call limit; the corrected session suite passed 172/172. The exact-head full gate and live #2190 continuation are pending, so no product completion is claimed here.
Residue: live-2190 | high | the real Telegram task stopped after using the prior call allowance; the saved working copy must resume under the new build and produce a useful answer.
Residue: full-suite | medium | the exact-head full test waits behind older Studio slot occupants and must be observed before final release status.

## Closing block

simplestRobustRoute: charge each dispatched model call durably under the existing spend cap and let the admitted Claude Code session continue until work or time ends.
80/20: focused and native tests prove the removed ceilings and safe accounting; the remaining decisive evidence is the actual #2190 completion in Justin's group.
VERDICT: author submission; this record asserts no independent verdict.
