# Change review — portable test fixtures and selection

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: Run portable fixture, policy, composition, permission and plist checks on Linux without claiming Linux support for macOS confinement or changing runtime safeguards.
Affected rules: 13, 26, 34, 36, 37, 49, 70, 74, 101, 102, 107, 111, 112, 113, 115, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake unchanged; execution and admission functions retain their behavior and native enforcement tests remain in the Mac selection.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Test selection affects coverage; two existing helper implementations move behind the same public exports without a behavior change.
Side effects: The split now detects hdiutil existence guards. Its file-level granularity excludes the mixed tool-turn and tool-persist files, explicitly named in the list; targeted unsplit runs still exercise their portable cases. New policy and keygen files plus host-watch and shipped-clients enter the portable selection. Native scratch uses a physically resolved writable root outside runtime reads. Existing source/composition pins need refresh because import closures change.
Undo and recovery: Revert this commit and its pins together. No installation, live journal, account or shared authority state changes; test artifacts remain machine-local.
Multi-machine posture: Machine-local tests deliberately observe their host's filesystem and runtime. Mac confinement evidence remains the Studio's responsibility; no peer or Mac is needed for the extracted portable checks.
Layer below: Read the temp redirection to /dev/shm, native runtime-read prefixes, nested gate fixture environment, stat device check, static import traversal and composition/runtime digest binding. The existing floors and refusal decisions are unchanged.
Bug class: unit
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only samples.
Convergence: none
Decision: LTP-fixtures | Clear only the nested synthetic gate environment and verify a genuinely different device rather than assuming /dev differs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-test-portability-1013-PROGRESS.md
Decision: LTP-seams | Extract unchanged native policy/parser/envelope and self-host composition evidence, preserving old exports; retain real confinement in Mac tests and validate scratch outside runtime reads. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-test-portability-1013-PROGRESS.md
Decision: LTP-host | Use Node stat for permission checks, Python plistlib for portable plist syntax, and explicit tool-existence guard detection; distinguish declared Mac runtime from the executing Linux runtime. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-test-portability-1013-PROGRESS.md
Decision: LTP-scope | Retain and report shared launcher, descriptor-handoff and host-census failures without repairing another product cause in this test-portability unit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/linux-test-portability-1013-PROGRESS.md
Prompt review: No prompt, parsing rule or acceptance behavior changes. Moved native functions retain their exact bodies. Existing real recorded model-output replay moves with the parser tests; no provider call, real login or Telegram send is made. Native confinement replay remains a Mac check, not falsely certified on Linux.

simplestRobustRoute: Use existing fixture environment isolation, real filesystem observations, Node stat and Python's standard plist parser. Extract the two existing helpers rather than hiding portable assertions behind the Mac split. Static import detection continues to expose native execution dependencies. No new runtime policy, retry, store or authority is introduced. Existing start, stop, resource, admission and durable journal guards remain intact; this test repair claims no unattended product completion.
80/20: Targeted changed/direct-import tests and machine checks, followed by the one explicitly requested portable gate attempt; report all failures and platform limitations separately.
VERDICT: author submission; no independent convergence claim
