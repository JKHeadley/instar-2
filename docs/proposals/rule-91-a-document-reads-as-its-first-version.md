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

A governed document — any file under `docs/` that a rule, register, or approval depends on — reads
as if it were written once, today.

- **No history in the body.** No revision numbers, revision notes, review responses, "what changed"
  prose, "the first draft said", or per-section revision markers. A statement that the document
  corrects another document is content and stays; a statement of *when* or *why* it was changed is
  history and moves.
- **History lives in a sibling changelog.** Every governed document `NAME.md` has
  `NAME-changelog.md` beside it: one entry per revision, newest first, each naming the date, the
  review or conversation that caused it, and what changed. The changelog is the only place review
  responses are written down.
- **The status line carries state, not history.** "draft, awaiting approval" or "approved" — never
  "revision 3".
- **Held by a build check.** A script walks every governed document and fails on a revision marker
  in the body: the words *revision*, *first draft*, *what changed in*, or a `§R` marker outside the
  changelog. A governed document with no sibling changelog also fails once it has more than one
  approved version (rule 90 supplies the version count).

## What it costs

A reviewer loses the in-place trail of "why is it like this now" and follows the changelog
instead. In exchange every later reader, human or model, sees one document.

## Questions for the operator

1. Is `docs/` the right boundary for "governed", or should this cover every markdown file in the
   repository?
2. Should the changelog be hand-written (as the glossary's now is) or generated from the approved
   pull requests, with the entry text taken from the PR description? Generated is the rule-90 shape;
   hand-written is honest today.
