# Part Two projections

`fold.ts` folds verified facts into read-only views through a closed, data-only fold language, and reads them back with their causal prefix checked. Views are runtime products, never writable records. Design: `docs/06-the-fact-envelope.md`.

Cold completeness uses the same causal index as fact admission, falling back to
the full walk for non-indexable graphs. Correction candidates are grouped by
original id once; exclusion, retraction and causal winner checks retain their
existing order. A conversation history with no corrections no longer pays an
all-pairs correction scan.
