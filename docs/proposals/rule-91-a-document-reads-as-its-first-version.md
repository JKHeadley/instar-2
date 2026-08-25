# Proposed rule 91 — a governed document reads as its first version

**Status: proposal, drafted from the operator's observation on 2026-08-24. Not a rule until approved.**

## The observation

When a document is reviewed, the response to each comment tends to get written into the document
itself: "revision 2, from the first review, replaces X with Y"; "the first draft said…"; a marker
on every paragraph the review touched. Two costs follow.

1. **The document gets harder to read.** Every reader after the reviewer wades through history to
   reach the content.
2. **The history skews later readers — especially models.** A model that ingests the document
   weighs what takes up space and what repeats. Revision notes take up space and repeat the
   content they annotate, so the model's picture of the document tilts toward what changed rather
   than what is. The glossary in this repository was carrying that cost: three revisions of notes,
   nine section markers, and a paragraph explaining which questions the first draft asked.

This is the aversion rule (rule 1, structure beats willpower) turned on documents: an author will
always be tempted to explain a change where the change lands. The rule removes the temptation by
giving the explanation a home of its own and refusing it anywhere else.

## The rule

A governed document reads as if it were written once, today.

- **No history in the body.** No revision numbers, revision notes, review responses, "what changed"
  prose, "the first draft said", or per-section revision markers. A statement that the document
  corrects another document is content and stays; a statement of *when* or *why* it was changed is
  history and moves.
- **History lives in a sibling changelog.** Every governed document `NAME.md` has a
  `NAME.changelog.json` beside it (format below): one entry per revision, each linking to the git
  changes that made it. The changelog is the only place review responses are written down.
- **The status line carries state, not history.** "draft, awaiting approval" or "approved" — never
  "revision 3".
- **Held by a build check.** A script walks every governed document and fails on a revision marker
  in the body: the words *revision*, *first draft*, *what changed in*, or a `§R` marker outside the
  changelog. A governed document with no sibling changelog also fails once it has more than one
  approved version (rule 90 supplies the version count), and its changelog fails validation if any
  required field is missing.

## What is "governed" — a property, not a folder

*(Operator asked whether `docs/` is the right boundary. Recommendation:)*

`docs/` is the wrong test, and so is "every markdown file". `docs/` will drift — a governed doc can
move out of it, and a scratch note can land in it — and "every markdown file" sweeps in READMEs,
design musings and generated files whose inline history is harmless, so the rule would just make
noise. **Governed is a property the document carries, checked by the build, established two ways:**

1. **Declared.** The document's status line marks it governed (the constitutional/spec docs —
   `01-the-rules`, `02-the-register`, `03-the-glossary`, and specs — carry this).
2. **Referenced.** A rule or register entry names the document as something it depends on. The build
   then *requires* that document to also carry the declared marker — so you cannot govern a document
   by reference while it quietly keeps its history. A referenced-but-undeclared document is a build
   failure that names the gap, the same shape as a dark feature.

`docs/` stays the conventional home for governed documents; it just isn't the definition. This keeps
the rule honest as the repo grows and matches the rule-90 shape, where governance is a fact a
document declares, not one its folder confers.

## The changelog format — JSON with required fields

*(Operator's call: hand-written entries, but each change links to the commit; a machine-checkable
shape so the link is enforced and a friendly view can be generated. Adopted:)*

`NAME.changelog.json` is an array of revision entries, newest first. Each entry:

```json
{
  "revision": 3,
  "date": "2026-08-24",
  "status": "approved",
  "cause": { "kind": "review", "pr": 3, "note": "operator review on PR #3" },
  "approvedIn": { "pr": 3, "mergeCommit": "<sha, filled on merge>" },
  "changes": [
    {
      "what": "reversible replaces undoable as the allowed value",
      "why": "one vocabulary, matching the rule's word (operator comment, line 12)",
      "commits": ["<sha>"],
      "ref": "msg #… or PR review comment id"
    }
  ]
}
```

- **Required:** `revision`, `date`, `status`, `cause`, and a non-empty `changes`, each change with
  `what`, `why`, and at least one of `commits` / `ref`. A validator (the shape of the existing
  retro-harvest validator) fails the build on a missing field — this is what makes "link to the
  change" enforceable rather than a habit.
- **The commit link is honest today.** `cause.pr` and each change's `ref` (the PR number or the
  review-comment id) are known when the entry is written by hand. `approvedIn.mergeCommit` and a
  change's `commits` are filled from git — either by hand after merge, or generated by a small step
  that reads the PR's merged commits. So the entry is hand-authored (honest now) *and* points to the
  actual changes in git (enforceable), which is exactly the balance you asked for.
- **The human-readable view is generated,** never hand-maintained: a script renders the JSON to a
  `NAME.changelog.md` (or a dashboard view) so people read prose and the machine reads the JSON.
  Generated markdown is not a governed document and carries no separate history.

## What it costs

A reviewer loses the in-place trail of "why is it like this now" and follows the changelog
instead. In exchange every later reader, human or model, sees one document — and every change is
linked to the commit that made it.

## One open question left for the operator

The three existing changelogs (this glossary's, and the harvest's on PR #4) are hand-written
markdown. On approval of this rule, should I convert them to `NAME.changelog.json` + a generated
markdown view, or leave them as-is and apply the JSON format only to changelogs written from here
on? Converting is tidy; leaving them is less churn on documents you've already reviewed.
