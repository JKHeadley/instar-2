/** Rules 7/10/30/93/96: supersession precedes conflict detection on every model route.
 * Port the 1.x supersedes edge + retained history rule through the journal's existing update action.
 * Meaning remains the model's judgment; code still validates exact sources and replacement clauses. */
export const MEMORY_SUPERSESSION = "The operator's latest direct statement of the same fact wins without correction wording; keep history. ";

export const MEMORY_DISAMBIGUATION = MEMORY_SUPERSESSION
  + 'Quotes/imports or concurrent claims do not supersede. Clarify only unresolved alternatives or ambiguous subjects; ignore corrected/forgotten items. ';

export const MEMORY_UPDATE_DECISION = MEMORY_SUPERSESSION
  + 'Changed same fact: update with offered old source/quote and exact new clause; keep history. Errors use correct. '
  + 'Use mode:"remember" only for a new independent fact, never to add a second current value of the same fact. ';
