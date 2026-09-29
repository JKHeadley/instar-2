# Change review — cint-L3b pipeline repair: main's transpile cache merged, combined-tree fixture and boundary repairs

Subject base: 287f5a8f608c34cffcc36edc3197644f7cb39d97
Review state: open
Reviewed content: none
Outcome: The merge of main (#137, the content-addressed slice transpile cache) is carried unchanged, with test:gate warming the cache before vitest. The Mama PC full run of that tree had 16 failures; the ones with a source fix inside this batch are repaired at their source. Launcher fixtures written before builds 10 and 11 landed together now carry what the combined launcher requires: the registered fixture doorway (build 10), the operator records the activation authority resolves (Rules 94/98), and, for the overlap case's deliberate second runner, its own conversation-ownership authority, exactly as the unfenced canary already had (build 11). U2's notice driver minted Results through a private sibling import, which the assembly boundary check refuses; it now sits beside its payload in src/effects and the host reaches it only through the public effects entry. The tool inventory covers the new test:gate, test:durability and warm-cache script (Rule 2). The journal-why byte window is re-measured on the combined tree (3500-4250; 3875 is used). The self-host composition is re-declared because #137 changed scripts/slice-ts-loader.mjs, one of its entry points (sha256:604a957a…5a7c); its contract case passes. Not repaired here and reported to the desk: the stale generated register (the desk's anchor step) and a combined-tree packet budget conflict (the fixed packet no longer fits the approved 32768-byte bound beside the 8192-byte reply-review headroom).
Affected rules: 2, 30, 37, 59, 74, 84, 94, 98, 105, 115, 116
Affected floors: secrets — unchanged; the notice driver's credential-free template and fixed bridge are byte-identical, only its module location changed; spend cap — unchanged, no model call type or bound changes; stop — unchanged; no duplicate sends — unchanged, the driver's record-before-send and never-resend logic is byte-identical; durable intake — unchanged
Operator questions: (1) the packet budget: the generated capability briefing (Rule 84), the working-disciplines source and the concurrent-work item together exceed the approved 32768-byte live context bound by about 940 bytes at the smallest variant, so a live turn is held as too large; raising the bound, trimming a source or letting guidance sources yield first is a design decision, not a merge repair; (2) the bootstrap-anchor refresh remains the desk's reviewed step (anchor sha256:10ee14b6…a200, unchanged)
Suggested tier: critical
Declared tier: critical
Tier rationale: the change touches the self-host composition declaration and the effects module's public surface
Side effects: src/effects/index.ts exports the infrastructure notice decoder, digest, renderer and dispatcher; scripts/host-watch.mjs imports the dispatcher from that entry; no runtime behaviour changes
Undo and recovery: revert this commit; nothing durable changes format
Multi-machine posture: machine-local, as before; no peer dependency is added
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md (read in full); scripts/check-assembly-contracts.mjs (the private sibling import rule and its single grant); scripts/composition-digest.mjs (the self-host closure includes the slice loader); tests/preview/journal.ts prompt admission (the reply-review headroom check that holds the over-budget turns)
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-overlap.test.ts
Hook bypass: none
Convergence: none
Prompt review: no prompt, system prompt or provider policy changed

## Closing block

simplestRobustRoute: Each failure is repaired where it arises with the smallest change: fixtures pass the arguments and authority the combined launcher already requires, the driver moves beside the payload it already depends on instead of widening the boundary grant, the inventory lists the scripts that exist, and a measured window is re-measured. No machinery is added.
80/20: tsc, the architecture check, lint (only the desk's pin message) and every touched test file pass on this machine; the full suite and the contract-map checks run at the gate.
VERDICT: author submission; the independent verdict is recorded as a pass
