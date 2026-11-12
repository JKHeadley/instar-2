# Required release checks on rules

**Status: draft, awaiting approval. Governed.**

A rule may carry `requiredReleaseCheck: { id, evidenceLocation, stage }`.
The strings `id` and `evidenceLocation` must be nonempty; `stage` is `build` or
`runtime`. The existing register fact-schema decoder refuses malformed fields.
Repository conversion reads these optional facts from
`register-source/rule-release-checks.json`, keyed by authoritative rule number.
An absent declaration emits nothing; holder evidence and prose imply no requirement.

Rule 117 declares `R117-TWO-SESSION-A-D`, at runtime: the two-session actions,
words/promises, mid-turn refresh and cross-machine obligations in
`LIVE-PATH-PLAN.md` section g, rows a–d. Its expected run artifact is
`release-evidence/{commit}/rule-117-two-session-a-d.json`, relative to the desk's
release artifact root, with `{commit}` replaced by the emitted source commit.
This is an evidence destination contract, not a claim that a writer or run exists.

`node scripts/build-register.mjs --check --required-release-checks` prints one
JSON object with `commit`, `generation`, `authority: "requirements-only"` and
`checks`, ordered by rule number. It also verifies the generated artifact
`generated/required-release-checks.json`. Each check has `rule` and the three facts.
No run is evaluated here. Rule 95 requires the desk's release judge to resolve
candidate-bound evidence and retain absent, failed and unknown outcomes as unpassed.
The shape-only publication retains pending runtime provenance; normal runtime shape
changes still require the existing verified parent and Part Two approval/append path.
