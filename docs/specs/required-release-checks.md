# Required release checks from registered rules

**Status: draft, awaiting approval. Governed.**

Release requirements live in `register-source/rule-release-checks.json`, keyed by
an authoritative register rule number. Each value has `id`, `evidenceLocation`
and `stage` (`build` or `runtime`). The existing fact validator rejects empty
strings, malformed objects, extra fields and unknown stages; unknown rule
numbers also refuse. An omitted requirement emits nothing. The file uses the
existing committed source roster and does not change the register shape, rule
facts or conversion anchor. Requirements are release metadata, not holder proof.

Rule 117 names `R117-TWO-SESSION-A-D`, at runtime: the two-session actions,
words/promises, mid-turn refresh and cross-machine obligations in
`LIVE-PATH-PLAN.md` section g, rows a–d. Its expected run artifact is
`release-evidence/{commit}/rule-117-two-session-a-d.json`, relative to the desk's
release artifact root, with `{commit}` replaced by the emitted source commit.
This names a destination, not an existing writer or a passing run.

`node scripts/build-register.mjs --check --required-release-checks` prints one
JSON object with `commit`, `generation`, `authority: "requirements-only"` and
`checks`, ordered by rule number, and checks `generated/required-release-checks.json`.
Each check has `rule` and the three metadata fields. Source edits require a
commit and ordinary replay regeneration. The desk's release judge must resolve
candidate-bound evidence and retain absent, failed and unknown runs as unpassed.
