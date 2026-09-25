import { expect, it } from 'vitest';
import { exerciseP15Round10Proof } from './round10-proof.js';

it('P15-NF-08 P15-NF-17 P15-NF-19 refuses collision history movement at review collision cut 4', () => {
  const proof = exerciseP15Round10Proof();
  expect(proof.collisions[4]!.changed()).toBe(true);
  expect(proof.collisions[4]!.reads()).toBe(4);
  expect(proof.collisions[4]!.first).toEqual({ status: 'refused', detail: 'package admission history frontier moved' });
  expect(proof.collisions[4]!.second).toEqual({ status: 'refused', detail: 'package declaration namespace collision' });
  expect(proof.collisions[4]!.competitor?.status).toBe('accepted');
  expect(proof.collisions[1]!.first.detail).toBe('package declaration namespace collision');
  expect(proof.collisions[99]!.first.status).toBe('accepted');
  expect(proof.collisions[99]!.second.status).toBe('accepted');
}, 20_000);

it('P15-NF-08 P15-NF-10 refuses dependency history movement at review dependency cuts 3 4 5', () => {
  const proof = exerciseP15Round10Proof();
  for (const cut of [3, 4, 5]) {
    expect(proof.dependencies[cut]!.changed()).toBe(true);
    expect(proof.dependencies[cut]!.first).toEqual({ status: 'refused', detail: 'package admission history frontier moved' });
    expect(proof.dependencies[cut]!.second).toEqual({ status: 'refused', detail: 'missing or mutable package dependency' });
    expect(proof.dependencies[cut]!.dependency.status).toBe('refused');
  }
  expect(proof.dependencies[1]!.first.detail).toBe('missing or mutable package dependency');
  expect(proof.dependencies[99]!.first.status).toBe('accepted');
  expect(proof.dependencies[99]!.second.status).toBe('accepted');
});

it('P15-NF-51 refuses every legacy execution-kind array before deriving learning policy', () => {
  const proof = exerciseP15Round10Proof();
  for (const file of ['legacy-health-check.json', 'legacy-benchmark-divergence-analysis.json']) {
    for (const kind of ['script', 'prompt', 'skill']) {
      expect(proof.legacy[`${file}:string:${kind}`]!.status).toBe('accepted');
      expect(proof.legacy[`${file}:array:${kind}`]).toEqual({ status: 'refused', detail: 'legacy execute type is unknown' });
    }
    expect(proof.legacy[`${file}:unknown`]!.status).toBe('refused');
  }
  expect(proof.legacy['learning:string-script']).toMatchObject({ status: 'accepted', learning: 'off', activation: 'eligible' });
  expect(proof.legacy['learning:array-script']).toEqual({ status: 'refused', detail: 'legacy execute type is unknown' });
});
