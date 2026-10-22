# Change review — train 129 phase two live merge repair

Subject base: d8e92f3876efce4e750d7941596e6c46c5eba229
Review state: open
Reviewed content: none
Outcome: Merge live 0f228c99 into train-129-p2, preserving the obligation wake and promise core alongside live quota selection, memory guidance and working-progress behavior.
Affected rules: 26, 37, 49, 74, 90, 101, 102, 105, 111, 112, 113, 116.
Affected floors: secrets — retain secret custody and quota credential redaction; spend cap — retain existing admission; stop — retain stopped quota and wake checks; no duplicate sends — retain journal intent settlement; durable intake — retain journal persistence.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Merge of previously reviewed runtime changes; resolution itself unions independent imports and regenerates dependent evidence.
Side effects: Both journal consumers now load all required dependencies. The combined composition invalidates the byte-bound Darwin native certificate; the Studio must renew it through its real contract.
Undo and recovery: Revert the merge on this branch and regenerate dependent publication. Keep both parent histories; never claim either old certificate proves the combined composition.
Multi-machine posture: Preserves existing cross-machine ownership and durable journal behavior. Local tests run in WSL; Darwin conformance remains Studio-owned.
Layer below: Reviewed both conflict hunks, existing promise core and transport wake exports, live quota reader and shared memory guidance; inspected native declaration conflict and generated-register provenance.
Bug class: none
Bug evidence: Pipeline refused the two import conflicts before any assertions ran. Typecheck and targeted obligation, quota, captured recall and progress tests exercise the combined imports.
Hook bypass: none
Convergence: none
Prompt review: No new prompt or output parser is authored by this repair; live prompt changes and their captured evidence retain their imported review records. Conflict resolution only retains imports required by both parent implementations.
Decision: train129p2-repair-import-union | Keep both independent import groups, preserving both parent behaviors with no new abstraction. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-129-p2-repair-100432-PROGRESS.md
Decision: train129p2-repair-native-certificate | Retain the branch declaration without forging a certificate for merged bytes; disclose the permitted R105 mismatch for the Studio contract run. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-129-p2-repair-100432-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=regenerated descriptions preserve existing tracked capabilities and their evidence

## Closing block

simplestRobustRoute: Union the independent imports and reuse the delegated owner-pin and register generators. This is the simplest robust route; it adds no machinery or authority and preserves both parents and their changelog histories. Existing floors remain the start and limit guards; targeted tests and the Studio gate judge the result. No autonomous completion claim is made.
80/20: Run typecheck, targeted tests and cheap gate checks; leave full-suite execution and native Darwin renewal to the Studio as directed.
VERDICT: author submission; no independent verdict asserted
