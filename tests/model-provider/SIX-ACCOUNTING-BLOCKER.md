# Add-only provider settlement / Six accounting incompatibility

The round-2 F1 direction requires the original `part-eight / EffectSettlement` registration to remain installed unchanged, and provider settlements to use their own unambiguous registration. The repair uses `effect-provider-ProviderEffectSettlement` and `ProviderEffectSettlement`, with an Eight-issued live `EffectSettlement` view.

The unchanged Six consumer is generic in its input handle but hard-codes the legacy fact kind:

- `src/transport/settlement.ts:106`: `settlementMatches` returns false unless `fact.kind === 'effect-EffectSettlement'`; it also compares the full wire body with the consumed view.
- `src/transport/settlement.ts:111`: `checkApplicationEvidence` requires the same exact legacy kind on historical accounting reconstruction.
- `src/transport/authority.ts:171`: no matching fact produces `owner-issued settlement missing from local fact prefix` before accounting mutation.

Thus the positive V1 and V20 chains and the Seven-resolution SIGKILL cut stop at Six. V11 can independently settle fresh late evidence at Eight, while credit release remains blocked. The required separate ordinary reply after Five acceptance cannot run because its provider prerequisite is blocked.

A second version of the SAME legacy kind does not safely resolve this: Part Two migrates every old body to the newest kind schema (`src/facts/admission.ts:170`). Its owned field dispatch uses the newest schema's owner/name. Routing it to a provider registration replaces legacy decoding again; retaining the old registration rejects provider requests because the legacy decoder requires an actual OutboundMessage. The binding explicitly forbids that disguise and replacement.

No Six source, original decoder, landed test, or landed checker is modified. No signed fact is rewritten or presented to Six under a false kind. Resolving this requires an additive Six-owner extension accepting the new Eight-owned kind and exact owner wire view at BOTH live and historical accounting boundaries, preserving the original default for every old settlement. That owner directory is outside this builder's granted cut.
