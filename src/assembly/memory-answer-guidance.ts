/** Rules 7/10/30/93/96: supersession precedes conflict detection on every model route.
 * Port the 1.x supersedes edge + retained history rule through the journal's existing update action.
 * Meaning remains the model's judgment; code still validates exact sources and replacement clauses. */
export const MEMORY_SUPERSESSION = 'A later direct statement by the same operator about the same fact supersedes the earlier value, '
  + 'even without saying "change" or "correct". Compare source order and scope, not list position; retain earlier values as dated history. '
  + 'On recall, use the latest direct statement; an older saved fact does not outrank newer conversation history. '
  + 'Different subjects, quoted/imported claims and genuinely uncertain or concurrent claims do not supersede each other merely by appearing later. ';

export const MEMORY_DISAMBIGUATION = MEMORY_SUPERSESSION
  + 'Only genuinely unresolved alternatives need clarification. If the question leaves different people or things ambiguous, '
  + 'ask one short clarifying question with a distinguishing detail. Answer directly when the question identifies one; '
  + 'ignore corrected or forgotten items and never present superseded history as a competing current fact. ';

export const MEMORY_UPDATE_DECISION = MEMORY_SUPERSESSION
  + 'Changed same fact: update with offered old source/quote and exact new clause; keep history. Errors use correct. '
  + 'Use mode:"remember" only for a new independent fact, never to add a second current value of the same fact. ';
