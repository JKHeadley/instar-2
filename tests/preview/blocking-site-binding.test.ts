// Rule 4 / P3-NF-19: the preview runner composes its checkpoints without a generated register, so each
// blocking site it enforces is bound to its committed declaration at launch (bindPreviewBlockingSites,
// called by journal-agent.mjs before the worker exists). Both sides: the committed declarations bind; a
// declaration that no longer says what its checkpoint does, or is missing or dark, refuses the launch.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { bindBlockingSite } from '../../src/register/governance.js';
import type { Json } from '../../src/types/values.js';
import { bindPreviewBlockingSites } from './journal.js';

type Declaration = { id: string; status: string; requiredFacts: Record<string, Json> & { rungs?: Record<string, Json>[] } };
const read = (path: string): Declaration[] => JSON.parse(readFileSync(path, 'utf8'));
const committed = () => ({ journal: read('tests/preview/journal.declarations.json'), replyCheck: read('tests/preview/reply-check.declarations.json'),
  redact: read('src/recall/redact.declarations.json'), resourceOwner: read('scripts/resource-owner.declarations.json') });
const edited = (list: Declaration[], id: string, edit: (d: Declaration) => Declaration) => list.map(d => d.id === id ? edit(d) : d);
const facts = (patch: Record<string, Json>) => (d: Declaration) => ({ ...d, requiredFacts: { ...d.requiredFacts, ...patch } });

describe('the preview runner binds every blocking site it enforces', () => {
  it('binds the committed declarations, one per enforced checkpoint', () => {
    expect(bindPreviewBlockingSites(committed())).toEqual(['preview.journal.gate', 'preview.journal.pollLimit',
      'preview.journal.capacityRefused', 'preview.reply-check.reviewReply', 'recall.redact', 'resource-owner.admit']);
  });
  it('refuses the launch when a declaration no longer matches its checkpoint', () => {
    const base = committed();
    const cases: [string, Parameters<typeof bindPreviewBlockingSites>[0]][] = [
      // The stop gate declared safety-open: the code holds closed.
      ['preview.journal.gate', { ...base, journal: edited(base.journal, 'preview.journal.gate', facts({ failDirection: 'open' })) }],
      // The cap claimed under another admission.
      ['preview.journal.capacityRefused', { ...base, journal: edited(base.journal, 'preview.journal.capacityRefused', facts({ decidesAloneBasis: 'operator-emergency-stop' })) }],
      // The poll gate re-declared as asking the mind.
      ['preview.journal.pollLimit', { ...base, journal: edited(base.journal, 'preview.journal.pollLimit', d => {
        const { decidesAloneBasis: _basis, ...rest } = d.requiredFacts; return { ...d, requiredFacts: { ...rest, decidesAlone: 'no', model: 'preview-subscription-claude' } }; }) }],
      // The reviewer's floor rung flipped open.
      ['preview.reply-check.reviewReply', { ...base, replyCheck: edited(base.replyCheck, 'preview.reply-check.reviewReply', d => ({ ...d,
        requiredFacts: { ...d.requiredFacts, rungs: d.requiredFacts.rungs!.map(r => ({ ...r, failDirection: 'open' })) } })) }],
      // The secret wall made dark, and the funnel's declaration removed.
      ['recall.redact', { ...base, redact: edited(base.redact, 'recall.redact', d => ({ ...d, status: 'dark' })) }],
      ['resource-owner.admit', { ...base, resourceOwner: base.resourceOwner.filter(d => d.id !== 'resource-owner.admit') }],
    ];
    for (const [id, declarations] of cases) expect(() => bindPreviewBlockingSites(declarations)).toThrow(`blocking site ${id}`);
  });
});

describe('bindBlockingSite', () => {
  const site = { type: 'Declaration', schemaVersion: 1, id: 'site', kind: 'blocking sites', status: 'live', requiredFacts: { authority: 'block',
    decidesAlone: 'ruled-three', decidesAloneBasis: 'spend-past-a-cap', criticality: 'the allowance is reached or it is not',
    failDirection: 'closed', preservesInput: 'capture:input', inspectedBy: 'check' } };
  const expected = [{ decidesAlone: 'ruled-three', decidesAloneBasis: 'spend-past-a-cap', failDirection: 'closed' }] as const;
  it('returns the id when the declaration says exactly what the checkpoint enforces', () => {
    expect(bindBlockingSite([site], 'site', expected)).toBe('site');
  });
  it('refuses a missing, duplicated, dark, non-blocking or mismatched declaration, and an empty expectation', () => {
    const mismatch = (patch: object) => [{ ...site, requiredFacts: { ...site.requiredFacts, ...patch } }];
    expect(() => bindBlockingSite([], 'site', expected)).toThrow('exactly one declaration, found 0');
    expect(() => bindBlockingSite([site, site], 'site', expected)).toThrow('exactly one declaration, found 2');
    expect(() => bindBlockingSite([{ ...site, status: 'dark' }], 'site', expected)).toThrow('not a live blocking-site declaration');
    expect(() => bindBlockingSite([{ ...site, kind: 'features' }], 'site', expected)).toThrow('not a live blocking-site declaration');
    expect(() => bindBlockingSite(mismatch({ authority: 'advise' }), 'site', expected)).toThrow('block authority');
    expect(() => bindBlockingSite(mismatch({ failDirection: 'open' }), 'site', expected)).toThrow('differs from the checkpoint');
    expect(() => bindBlockingSite(mismatch({ decidesAloneBasis: 'live-secret-leaving' }), 'site', expected)).toThrow('differs from the checkpoint');
    // The declaration itself must still decode as a rung: a basis on a model rung is refused before comparison.
    expect(() => bindBlockingSite(mismatch({ decidesAlone: 'no', model: 'm' }), 'site', expected)).toThrow('requires a ruled-three rung');
    expect(() => bindBlockingSite([site], 'site', [])).toThrow('differs from the checkpoint');
  });
});
