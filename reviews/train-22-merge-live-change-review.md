# Change review — train-22 live merge repair

Subject base: d9ec3aef96c66e5bf77a03d495cb394ce4df8139
Review state: open
Reviewed content: none
Outcome: Merge train-19 into train-22, retaining both changelog histories and all three train-22 portability and pool-relocation repairs.
Affected rules: Purpose 2/3; Rules 1, 26, 34, 36, 37, 49, 60, 70, 74, 90, 91, 101, 102, 111, 112, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain the existing admission, custody, ownership, journal and dispatch paths. No serving credentials or live journal writes.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates reviewed model-facing refusal/reminder changes with installation and physical-launch repairs; no new policy or authority.
Side effects: Both parents' changelog content survives. Existing train-22 entries remain an exact suffix; distinct incoming entries are appended with sequential revision numbers required by the existing validator. Markdown is rendered from JSON. No product source or document body conflicts occurred; incoming train-19 behavior merges automatically and train-22 pool relocation remains intact. Generated publications are regenerated from committed sources.
Undo and recovery: Revert this merge and publication before deployment if needed, retaining both parents and all journal evidence. Do not erase prepared records or replay uncertain sends; roll forward for journals containing optional refusal diagnostics.
Multi-machine posture: Existing shared conversation ownership and durable-send fences remain. Pool record paths resolve within each machine's current installation; external credential custody remains external. Kernel limits and prepared records remain deliberately machine-local, with no peer dependency added.
Layer below: Read purpose and rules from origin/main in full, the train-19 and train-20 merge records, all three train-22 member records, changelog validation and Rule 90 suffix enforcement. Compared both parent histories and automatic product merges. Source pins derive from actual merged bytes.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory has sample hooks only, checked before committing.
Convergence: none
Prompt review: No new prompt or verdict policy authored. Incoming train-19 recorded refusal/reminder and act-first fixtures exercise real summary uncertain, Jev uncertain/undecided, reply-review and delivered/empty shapes. No live provider calls or live acceptance claimed; desk owns live use.
Decision: train-22-live-merge | Ordinary merge of origin/train-19 ac3bd4d8 into train-22 d9ec3aef preserves both ancestors and all product behaviors; no product or docs-body conflict required a choice. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-22-merge-live-1013-PROGRESS.md
Decision: train-22-live-history | Preserve train-22 changelog suffix exactly and append nine distinct train-19 revisions across seven files. Only revision identifiers change to satisfy uniqueness/order; dates, causes, approvals and changes survive. Render markdown using the existing tool. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-22-merge-live-1013-PROGRESS.md
Decision: train-22-live-publication | Regenerate publications via the existing desk repin, build, owner rehash and register replay chain. Prior generated files are temporary inputs only, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-22-merge-live-1013-PROGRESS.md
Decision: train-22-live-checks | Run bounded foreground targeted and direct-consumer tests on WSL; identify macOS/Studio-dependent checks separately and leave the absolute reported path for the desk to populate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-22-merge-live-1013-PROGRESS.md

Prompt finding: e8708c7fea24 | protocol-literal | Unchanged attribution instruction; the cited recall test checks that it reaches the packet. This repair adds no phrase-based judgment.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response; the cited test checks its existing renderer, not a classifier introduced by this change.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 849db3a6296a | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: aef7d91bef51 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"
Prompt finding: 0abb3dc96311 | protocol-literal | Historical prompt translation checks the reviewed unresolved-date admission instruction; it is not an expected model answer or an intent detector.
Prompt finding: 7c45ffbe90ad | protocol-literal | Historical prompt translation checks the new admitted-reminder evidence field while retaining the recorded verdict; it is not an expected model answer or an intent keyword test.
Prompt finding: b1bb3946362d | protocol-literal | Existing production-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Prompt finding: 42faf877ba82 | protocol-literal | Existing production-codex-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Deferral: tests/preview/fixtures/reminder-relative-1013.json:329 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
Deferral: tests/preview/fixtures/reminder-relative-1013.json:772 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
Deferral: tests/preview/fixtures/reminder-relative-1013.json:793 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise
Deferral: tests/preview/fixtures/reminder-relative-1013.json:803 | not-a-deferral=Historical captured model output retained verbatim as regression evidence, not an author promise

Publication: Register regenerated from source 70e1b67ccc48cb75e2ffd22d10cce1194b4f5f70, generation sha256:3b5a08d17e1ee3faf56c062a0f784320b19a3c7cd6b91d66f24968a02a2dd9e6; this review covers the merge and generated publication.

simplestRobustRoute: This is the simplest robust route: ordinary merge, append-only history union, existing renderers and publication tools. No new runtime machinery or check bypass. Existing verified intake and admission are start guards, durable dispatch is the end guard, and stop, spend and resource bounds remain limit guards. This gate candidate does not claim unattended live acceptance.
80/20: Target changed tests and direct imports, member tests and required machine checks; no full suite or second base worktree.
VERDICT: author submission; independent landing review belongs to the desk
