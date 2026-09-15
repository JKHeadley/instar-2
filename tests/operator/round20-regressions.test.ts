import { expect, it } from 'vitest';
import { prepareSnapshot } from '../../src/facts/index.js';
import { snapshotCurrent } from '../../src/facts/snapshot.js';
import { createOperatorSurface } from '../../src/operator/index.js';
import { value } from '../facts/fixtures.js';
import { round20RevocationAdmission } from '../intake/round20-fixtures.js';
import { operatorFixture } from './fixture.js';

it('round20 V67/V68 P11-NF-08/17/18/21 renders the owner-resolved revocation target, never requester prose as target', () => {
  const row = round20RevocationAdmission('intended'), base = operatorFixture(), fixture = row.fixture;
  const facts = fixture.facts();
  const decode = { ...fixture.context.decode, principals: [fixture.f.alice, fixture.f.bob, fixture.f.carol] };
  const current = () => value(prepareSnapshot(facts, { ...fixture.context, decode, facts }));
  const history = { ...base.history, current: () => fixture.f.success(current()),
    isCurrent: (snapshot: ReturnType<typeof current>) => fixture.f.success(snapshotCurrent(snapshot)),
    decode: () => decode, generation: () => fixture.generation,
    clock: () => fixture.f.clock(fixture.deps.clock().value),
    expectedKind: (reference: string) => facts.find(fact => fact.id === reference)?.kind ?? null };
  const surface = value(createOperatorSurface({ ...base.composition, history }));
  const rendered = value(surface.render(row.input.request.id));
  expect(rendered.revocationTarget).toMatchObject({ id: 'target:intended', digest: row.request.artifact });
  expect(rendered.plainLanguageEffect).toContain('standing grant target:intended');
  expect(rendered.plainLanguageEffect).not.toContain('target:other');
  expect(rendered.requesterText.text).toContain('target:other');
});
