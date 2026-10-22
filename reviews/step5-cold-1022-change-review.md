# Change review — verified fact-store cold start

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: Reconstruct a 20,000-message signed record and its open run without repeatedly walking and decoding the entire ancestry. The measured cold read, status reconstruction and populated run fold reached 14.76 seconds on the Studio; this is core startup over retained input, not whole-service boot or a disk durability latency claim.
Affected rules: Rules 1, 4, 7, 13, 26, 30, 32, 33, 34, 35, 36, 37, 42, 49, 60, 70, 74, 101, 102, 111, 113 and 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their original owners. Every source signature and chain link still verifies; historical wrappers do not become live authority. No source records are deleted or rewritten.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes verification reuse and historical reconstruction in the shared fact path, so equivalence, corruption, policy invalidation, restart and recorded-shape evidence matter alongside timing.
Side effects: Disposable memory replaces repeated work. The signed-origin memo holds at most 64 MiB of encoded origin content and 32,768 entries, with parsed-object overhead additional; reaching either limit clears optimization, while oversized origins verify uncached. Dense constitutional dependency graphs still pay for the dependencies they consume. The native self-host certificate becomes stale because composition bytes changed.
Undo and recovery: Revert the source and tests together. There is no new persisted format, migration, signing key or durable cache to remove; retained source facts rebuild using either version. A process interruption discards local derived products and leaves original storage intact.
Multi-machine posture: Signed facts remain shared and each machine verifies its own retained source. Chain heads, causal indexes, migration results and cryptographic/origin memos are disposable machine-local computations. Current keys, captures, revocations, standing, lineage completeness and ownership remain checked by their existing owners. Independent-lineage and conflicting/reordered-input tests cover the multi-machine case.
Layer below: Read the constitution, prior step5 record report and keep/cut table; inspected 1.x main 2d12a2a9a4fa2d0eb1280abdbd573234913ceb6b SemanticMemory open/importFromJsonl/writeSnapshot and StoreSnapshot materializeSnapshot/cutover. Reused their single-pass keyed accumulation and retained-source rebuild shape through existing 2.0 storage/fact ports. SQLite and unsigned snapshot restoration cannot substitute for signed 2.0 admission; no large 1.x file, corruption-skipping behavior or deletion path is transplanted. Audited P1 canonical boundaries, historical origin verification, P2 chain/causal index and snapshot invalidation, and Five's owner replay.
Bug class: integration
Bug evidence: reproducer=tests/recall/cold-start.test.ts
Hook bypass: none; inspected core.hooksPath (unset) and the common hooks directory (sample files only).
Convergence: none
Prompt review: No prompt, model-output parser, judgment policy or how-to-work text changes. Recorded intake text is source data, copied from the prior sanitized proof-room fixture.
Decision: cold-single-pass | Adapt 1.x per-origin/per-key accumulation to verified chain loading and correction lookup, reuse the existing exact causal index, and retain the refusing walk when it cannot answer. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md
Decision: cold-sparse-ancestry | Decode each ancestor under its own causal standing within a read-only operation; retain sparse constitutional history in original DFS order with an explicit stack. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md
Decision: cold-reuse-exact-bytes | Reuse byte-identical admitted frames under current key/register policy and encode already captured JSON without another validation copy; all untrusted public entries retain canonical validation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md
Decision: cold-bounded-origin | Retain bounded private proof of exact signed-origin bytes and key, never decoded value standing. Current policy, captures, paths and semantic decoding remain outside the memo. Test both bounds with tiny injected capacities. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md
Decision: cold-operation-migration | Share each exact envelope's migration between status and historical decoding only within their read-only operation, preserving output/refusals and new-operation invalidation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md

Decision: cold-empty-live-manifest | Skip repeated live decoding only after historical validation proves a plain-only schema; constitutional and owned fields retain their live paths. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step5-cold-1022-PROGRESS.md


ELI16: Restart used to check the same old messages and their ancestors over and over. It now checks each message, keeps the proof while building the record, and looks up links it has already established. A changed key, missing evidence or altered message still fails its original checks. Restarting halfway through starts safely from the saved messages.

Verification: Targeted final verification and exact pushed-head command evidence are recorded in the unit's PROGRESS file. The architecture check currently reports only the charter-exempt native macOS composition certificate mismatch; the declaration is unchanged and the desk owns re-certification.

simplestRobustRoute: This is the simplest measured route that met the target: keep the signed source and existing store/projection machinery, remove repeated ancestry, indexing, canonical copying and migration work, and retain bounded proofs of exact signed bytes. The simpler single-origin memo still took 17 seconds; the bounded origin memo and operation-local migration reuse reached 14.76 seconds. No durable checkpoint protocol, replay daemon, new authority, prompt scaffolding or schedule is introduced. Existing signature, key, chain, causal completeness, capture and standing checks guard entry; equality, corruption/refusal, interruption/restart and populated-run tests guard the end state; cache byte/count limits bound retained optimization. No autonomous user-task completion or live deployment is claimed.
80/20: Recorded-shape red/green timing, focused validation and replay suites, real-disk restart and final pinned gates verify this slice; no full-suite or independent-review claim.
VERDICT: author submission; independent desk acceptance pending
