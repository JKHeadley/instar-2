import { expect, it } from 'vitest';
// @ts-expect-error The executable contract checker intentionally ships as an ESM script without declarations.
import { checkP15Architecture, p15Dispositions } from '../../scripts/check-p15-contract-map.mjs';
import { exerciseP15Round9Proof } from './round9-proof.js';

it('P15-NF-16 P15-NF-17 re-resolves package retirement after every earlier validation read', () => {
  const proof = exerciseP15Round9Proof();
  for (const cut of ['3', '4']) {
    expect(proof.retirement[cut]!.changed).toBe(true);
    expect(proof.retirement[cut]!.admitted).toEqual({ status: 'refused',
      detail: 'active package transition missing or ambiguous' });
    expect(proof.retirement[cut]!.ownerNow).toEqual(proof.retirement[cut]!.admitted);
  }
  expect(proof.retirement[20]).toMatchObject({ admitted: { status: 'accepted' },
    ownerNow: { status: 'accepted' }, changed: false });
});

it('P15-NF-08 P15-NF-09 P15-NF-10 P15-NF-19 refuses every ambiguous second scheduled manifest', () => {
  const proof = exerciseP15Round9Proof();
  expect(proof.resources.support).toEqual({ selectedOriginal: { status: 'accepted' },
    selectedExtra: { status: 'refused', detail: 'type or schema version unknown; migration must advance exactly once' } });
  expect(proof.resources['normal-second']!.selectedOriginal).toEqual({ status: 'refused',
    detail: 'package contains multiple scheduled work manifests' });
  for (const kind of ['repeated-type', 'repeated-type-overridden', 'repeated-display-name', 'repeated-at'] as const) {
    expect(proof.resources[kind]!.selectedOriginal.status).toBe('refused');
    expect(proof.resources[kind]!.selectedOriginal.detail).toMatch(/^ambiguous JSON repeats member /);
    expect(proof.resources[kind]!.selectedExtra).toEqual(proof.resources[kind]!.selectedOriginal);
  }
});

it('P15-CONTRACT-MAP accepts only the row-80 conditional package-activity grant name', () => {
  const dispositions = p15Dispositions();
  for (const number of [17, 19]) {
    expect(dispositions.find((row: { number: number }) => row.number === number)?.held)
      .toContain('P15-P10-package-resource-and-activity-v1');
  }
  expect(() => checkP15Architecture(dispositions.filter((row: { number: number }) => ![6, 13, 22].includes(row.number)))).not.toThrow();
  const wrongName = 'NON-EXECUTABLE-UNTIL-P15-P10-package-resource-and-activity-v2';
  const altered = dispositions.map((row: { number: number }) => row.number === 17
    ? { ...row, held: wrongName, status: `EXECUTABLE-ARMS; ${wrongName}`, reason: wrongName } : row);
  expect(() => checkP15Architecture(altered)).toThrow(/consistent disposition|unrecognized conditional grant/);
});
