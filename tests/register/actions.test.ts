// @ts-nocheck -- exercises the shipped JavaScript build adapter.
// Rule 57: a judgment point's floor decodes only against the finite action metadata
// committed beside its owner; the registry is never derived from what a floor requests.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { actionRegistry, buildContext } from '../../scripts/register-source.mjs';
import { consumeResult, decode } from '../../dist/index.js';

const shape = JSON.parse(readFileSync('register-source/bootstrap-shape.json', 'utf8'));
const owned = { 'tests/preview/reply-check.actions.json': readFileSync('tests/preview/reply-check.actions.json', 'utf8') };
const floor = (actions, dflt) => ({ type: 'ActionFloor', schemaVersion: 1, actions, default: dflt });
const outcome = (value, types) => consumeResult(decode('ActionFloor', value, types), { Success: () => 'accepted', Refused: r => r.detail });
const file = actions => JSON.stringify({ schemaVersion: 1, owner: 'x', actions });

describe('build action registry', () => {
  it('is exactly the committed owner metadata', () => {
    expect(actionRegistry({ ...owned, 'docs/other.json': '{}' })).toEqual({
      'preview.reply.hold': { protected: false, repository: false },
      'preview.reply.release': { protected: false, repository: false },
    });
    expect(actionRegistry({})).toEqual({});
  });
  it('refuses malformed, extra-field and duplicate metadata', () => {
    expect(() => actionRegistry({ 'a.actions.json': file({}) })).toThrow('malformed action metadata');
    expect(() => actionRegistry({ 'a.actions.json': JSON.stringify({ schemaVersion: 1, owner: 'x', actions: { 'a.b': { protected: false, repository: false } }, more: 1 }) })).toThrow('malformed action metadata');
    expect(() => actionRegistry({ 'a.actions.json': file({ 'a.b': { protected: 'no', repository: false } }) })).toThrow('malformed metadata for action a.b');
    expect(() => actionRegistry({ 'a.actions.json': file({ Bad: { protected: false, repository: false } }) })).toThrow('malformed action name');
    expect(() => actionRegistry({ 'a.actions.json': file({ 'a.b': { protected: false, repository: false } }),
      'b.actions.json': file({ 'a.b': { protected: false, repository: false } }) })).toThrow('duplicate action a.b');
  });
  it('the unchanged ActionFloor decoder admits the reviewed floor and still refuses the rest', () => {
    const { types } = buildContext(shape, [], 'a'.repeat(40), 1_790_000_000_000, actionRegistry(owned));
    expect(outcome(floor(['preview.reply.hold', 'preview.reply.release'], 'preview.reply.hold'), types)).toBe('accepted');
    expect(outcome(floor(['preview.reply.hold', 'preview.reply.send-anything'], 'preview.reply.hold'), types)).toBe('action: unregistered');
    expect(outcome(floor(['preview.reply.hold'], 'preview.reply.release'), types)).toBe('default: outside floor');
    // Without the committed metadata no floor is admissible (the pre-repair context).
    const empty = buildContext(shape, [], 'a'.repeat(40), 1_790_000_000_000).types;
    expect(outcome(floor(['preview.reply.hold'], 'preview.reply.hold'), empty)).toBe('action: unregistered');
  });
  it('the shipped reply-review judgment point declares that floor with the conservative hold default', () => {
    const declared = JSON.parse(readFileSync('tests/preview/reply-check.declarations.json', 'utf8'))
      .find(d => d.id === 'preview.reply-check.parseReplyReviewVerdict');
    expect(declared.kind).toBe('judgment points');
    expect(declared.requiredFacts).toEqual({ floor: floor(['preview.reply.hold', 'preview.reply.release'], 'preview.reply.hold'), benchmark: 'unmeasured' });
    const generated = JSON.parse(readFileSync('generated/register.json', 'utf8')).entries.map(e => e.declaration)
      .find(d => d.id === 'preview.reply-check.parseReplyReviewVerdict');
    expect(generated?.declaredBy.path).toBe('tests/preview/reply-check.declarations.json');
  });
});
