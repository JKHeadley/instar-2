import type { Run, RunStep, RunTransition, RunExit, RunBudget, SessionGrounding, PrincipalReference } from '../../src/rungraph/index.js';
import type { VerifiedPrincipal } from '../../src/index.js';
declare const run: Run, step: RunStep, transition: RunTransition, exit: RunExit, budget: RunBudget, grounding: SessionGrounding;
// P5-NF-02: spreading public fields cannot manufacture the owner's private brand.
// @ts-expect-error owner decoder required
const fakeRun: Run = { ...run };
// @ts-expect-error owner decoder required
const fakeStep: RunStep = { ...step };
// @ts-expect-error owner decoder required
const fakeTransition: RunTransition = { ...transition };
// @ts-expect-error owner decoder required
const fakeExit: RunExit = { ...exit };
// @ts-expect-error owner decoder required
const fakeBudget: RunBudget = { ...budget };
// @ts-expect-error owner decoder required
const fakeGrounding: SessionGrounding = { ...grounding };
declare const reference: PrincipalReference;
// @ts-expect-error a historical reference is not live authority
const principal: VerifiedPrincipal = reference;
void [fakeRun, fakeStep, fakeTransition, fakeExit, fakeBudget, fakeGrounding, principal];
