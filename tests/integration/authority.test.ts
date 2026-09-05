import { expect, it } from 'vitest';
import { consumeResult, decode, isValid, readEvidence } from '../../src/index.js';
import { fixture, raw, value } from '../fixtures.js';
it('signed source → principal → grant → exact approval → revocation → invalid current approval', () => {
  const f = fixture(); const approval = f.authInput({ action: { kind: 'merge', scope: f.scope } });
  const authorization = value(decode('Authorization', approval.input, approval.context));
  expect(isValid(authorization, authorization.base, authorization.artifact, f.now, f.ctx)).toBe('valid');
  const payload = { id: 'r1', grantId: f.g.id, by: f.alice, at: f.clock(101), reason: 'withdrawn' };
  const { p } = f.proof(payload, { id: 'alice', kind: 'person' }, 'revocation');
  f.revocations.push(value(decode('Revocation', raw('Revocation', { ...payload, source: p }), { ...f.ctx, provenance: p })));
  expect(isValid(authorization, authorization.base, authorization.artifact, f.clock(101), f.ctx)).toBe('standing-not-live');
  expect(value(readEvidence(f.e, f.clock(101), f.ctx.preserved))).toMatchObject({ predicate: 'exists' });
});
it('directive exercise uses a verified binding and cannot widen it', () => {
  const f = fixture(); const requester = f.principal('alice', 'person', true);
  const bindingPayload = { principalId: requester.id, channel: 'host', grantId: f.g.id, scope: f.scope };
  const { p } = f.proof(bindingPayload, { id: 'alice', kind: 'person' }, 'conversation-binding');
  const context = { ...f.ctx, binding: { reference: { owner: 'part-four' as const, name: 'ConversationBinding' as const, id: 'binding:1' }, source: p, ...bindingPayload } };
  expect(value(decode('Directive', f.directiveInput({ principal: requester }), context)).principal.id).toBe('alice');
  for (const ctx of [f.ctx, { ...context, binding: { ...context.binding, scope: f.org } }]) {
    consumeResult(decode('Directive', f.directiveInput({ principal: requester }), ctx), {
      Success: () => { throw new Error('unbound directive accepted'); }, Refused: r => expect(r.detail).toContain('binding'),
    });
  }
});
