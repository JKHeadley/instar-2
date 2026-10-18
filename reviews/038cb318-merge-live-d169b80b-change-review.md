# Change review — merge live train-60 into train-57

Subject base: 038cb318c59bccb89fb130b35e929e3946092b4b
Review state: open
Reviewed content: none
Outcome: Preserve train-57 completion, login, backup, compaction and cleanup behavior while incorporating live train-60 and its directive/preference regression evidence.
Affected rules: 1, 12, 26, 27, 34, 36, 37, 49, 74, 90, 91, 93, 101, 102, 111, 112, 113, 116
Affected floors: secrets — existing custody unchanged; spend cap — no new provider calls; stop — existing precedence unchanged; no duplicate sends — no new dispatch; durable intake — journal and retained history unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition retains the reviewed trains and their runtime checks; acceptance remains with the desk.
Side effects: Only seven generated files conflict. Retain the first-parent publication provisionally and replay it against the committed composition. The clean content merge adds D5 directive/preference tests and its owner-reference pin. No runtime source, prompt, parser or acceptance condition is authored by this merge.
Undo and recovery: Revert the merge against its first parent and replay the register, retaining both histories and all journals; never replay uncertain effects.
Multi-machine posture: Tree composition is identical on all hosts. Existing ownership, local worker control and shared journal semantics remain unchanged; no new authority or state.
Layer below: Read both governing documents in full and confirmed they match origin/main. Inspected the seven driver conflict records, previous train merge reviews, D5 projection evidence, and the production prompt with its journal-people consumer assertion. The fixture copies a semantic ambiguity instruction to assert delivery; the prompt does not match fixture answers or prescribe a verdict for Sam.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No model-facing changes introduced. Existing semantic clarification guidance is checked by a fixture for its presence and policy transport. Replay member recorded-shape tests on the combined tree, without claiming a new live run.
Prompt finding: 450c79237a95 | protocol-literal | journal-people.test.ts asserts the existing general ambiguity instruction is present and carried by subscriptionConversationPolicy. The instruction asks the model to resolve meaning across conflicting or distinct referents, never to block on a fixture phrase or return an expected Sam answer. Both prompt and assertion are unchanged by this merge.
Prompt finding: 4106b49fff07 | protocol-literal | Existing source-bound action claim protocol, retained unchanged; test checks the protocol rather than giving an expected verdict.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory display literal retained unchanged, not an added semantic classification rule.
Prompt finding: e8708c7fea24 | protocol-literal | Existing sourceLabel attribution instruction; the regression checks delivered guidance, not a desired semantic answer.
Decision: train57-merge1017-compose | Merge exact live d169b80b into 038cb318, preserve both histories, and regenerate the seven generated conflicts through the existing replay tool. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-57-merge-1017-PROGRESS.md
Decision: train57-merge1017-prompt | Disposition 450c79237a95 as a protocol assertion after reading both sources; do not change correct semantic guidance to silence a scan. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-57-merge-1017-PROGRESS.md

Publication: Seven generated artifacts replayed from source d155f6e94df1fc33c654c868de8df981a0692a7b, generation sha256:38ff94225194b1974c52d3524b300595b983de9e3028c6a063a70e6844a037de. Both desk pin tools report zero stale pins; architecture and typecheck pass. This record covers the merge and derived publication.

simplestRobustRoute: This is the simplest robust route: ordinary merge, existing derived-register replay, one truthful finding disposition and targeted regression verification. No added mechanism. Start at the named heads; keep safety, ownership and uncertainty floors; finish with committed ancestry, fresh pins and measured checks. No unattended live acceptance claim.
80/20: Five member tests, imported D5 tests and prompt consumer regression; portable pinned checks, build, typecheck, lint and register verification. Studio owns full-suite and native-host acceptance.
VERDICT: author submission; independent desk acceptance pending
