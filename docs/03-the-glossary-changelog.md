# Changelog — `03-the-glossary.md`

The glossary itself reads as a first version. Everything about how it got there lives here, one
entry per revision, newest first. Each entry says what changed and which review comment caused it.

## Revision 3 — 2026-08-24, from the conversation while the second review was open

- History becomes a rule: "History is a lookup" (rule 90). Every governing thing is versioned by
  construction — `supersedes` and `approvedIn` join the common facts, generated from git.
- The rules themselves become a register kind (13), with `parent` and `mergedInto` declared and
  `children`, `siblings`, `enforcedBy` derived. The rule book becomes a rendering of that kind.
- Questions 5 and 6 added to "What I want from you on this document".

## Revision 2 — 2026-08-24, from the first review (PR #3)

- `reversible` replaces `undoable` as the allowed value: one vocabulary, matching the rule's word.
- The runaway rule: a profile describes the worst case the code can produce before anyone can stop
  it. A failure that takes a channel away (a flood, an unbounded notifier) is `control`, therefore
  critical — the first draft's "merely bothers" would have let a flood through on its
  single-message case.
- *Operator* and *user* reframed around **principals** and **standing**. The first draft defined
  operator as "the one verified person" and also said "every operator is a user"; both were half
  right, and the contradiction resolves once operator is a standing a verified person holds in a
  scope.
- The terms registry becomes a real register kind (12) rather than a sentence. The first draft
  said each definition "is itself a register entry (kind: term)"; the review asked whether that was
  a real structure or a figure of speech. It was a figure of speech.
- Both `userFacing` and `significance` on features become derived columns (the first draft named
  only one), a correction to step two.
- The four questions from the first draft (derive-don't-declare, the profile's allowed values,
  visibility-vs-damage, the strictness of *done* and *approved*) drew no objection and stand.

## Revision 1 — 2026-08-24

- First draft: derive *irreversible*, *user-facing*, *critical*, *significant* from a declared
  profile; define the nouns the register's required facts lean on; four questions for the operator.
