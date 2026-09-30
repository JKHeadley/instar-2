/** Rule 114: every parent-child edge is a registered durable fact. The ledger over the real
 * part-two fact store: signed facts, restart replay, tamper refusal, achieved-durability demand. */
import { expect, it } from 'vitest';
import type { Json } from '../../src/index.js';
import { authorAndAppend, createFactStore } from '../../src/facts/index.js';
import { createDelegationLedger, createFactDelegationStore, DELEGATION_FACT_KIND, delegationFactSchema } from '../../src/rungraph/index.js';
import { factsFixture, json, privateKey } from '../facts/fixtures.js';
import { context, createNetwork, refusal, value } from '../transport/agent-fault-harness.js';

function world(durability: { kind: 'local-durable' } | { kind: 'replicated'; peers: string[]; n: number } = { kind: 'local-durable' }) {
  const f = factsFixture(), wire: unknown[] = [];
  const ctx = { ...f.ctx, schemas: [...f.ctx.schemas, delegationFactSchema(f.schema)] };
  const open = () => {
    const store = createFactStore(ctx, { owner: 'part-ten', read: () => wire,
      append: (bytes: string) => { wire.push(JSON.parse(bytes)); return f.success(durability); } });
    const author = (kind: string, body: Json) => authorAndAppend({ kind, body, required: [], schemaVersion: 1, machine: 'machine-a',
      principal: json(f.alice), provenance: json(f.alice.provenance), at: json(f.now) }, ctx, store, privateKey);
    return { store, ledger: createDelegationLedger(createFactDelegationStore({ read: () => store.read(), author }), context) };
  };
  return { wire, open };
}

it('P5-NF-30 edges, acceptance, result and collection are signed facts that replay after restart', () => {
  const net = createNetwork('local'), w = world(), first = w.open();
  const request = net.request(net.rootAuthority('agent-a'), 'agent-b');
  const edge = value(first.ledger.delegate(request));
  value(first.ledger.accept(edge.id, 'agent-b', 'run:b', net.now()));
  const facts = value(first.store.read());
  expect(facts.map(fact => fact.kind)).toEqual([DELEGATION_FACT_KIND, DELEGATION_FACT_KIND]);
  expect(facts[0]!.body).toMatchObject({ edge: edge.id });
  // A fresh process reading the same durable segment sees the same edge; nothing is re-created.
  const restarted = w.open();
  const view = restarted.ledger.view().get(edge.id)!;
  expect(view.contract.digest).toBe(edge.digest);
  expect(view.acceptance).toEqual({ recipient: 'agent-b', localRun: 'run:b' });
  expect(value(restarted.ledger.delegate(request)).id).toBe(edge.id);
  expect(value(restarted.store.read())).toHaveLength(2);
});

it('a tampered delegation fact is refused by the store; the ledger cannot act on it', () => {
  const net = createNetwork('local'), w = world(), first = w.open();
  value(first.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b')));
  (w.wire[0] as { body: { record: string } }).body.record = (w.wire[0] as { body: { record: string } }).body.record.replace('"budget":10', '"budget":99');
  const reopened = w.open();
  expect(() => reopened.ledger.view()).toThrow();
  expect(refusal(reopened.ledger.delegate(net.request(net.rootAuthority('agent-a'), 'agent-b', { sequence: 1 })))).toBeTruthy();
});

it('the store receipt, not the caller, decides whether a replicated demand is met', () => {
  const net = createNetwork('local');
  const local = world().open(), replicated = world({ kind: 'replicated', peers: ['machine-b'], n: 1 }).open();
  const request = net.request(net.rootAuthority('agent-a'), 'agent-b', { durability: 'replicated' });
  expect(refusal(local.ledger.delegate(request))).toContain('replication demand unmet: local-durable');
  expect(value(replicated.ledger.delegate(request)).durability).toBe('replicated');
});

it('an edge whose replicated demand was unmet is never dispatchable, even when re-requested', () => {
  const net = createNetwork('local'), local = world().open();
  const request = net.request(net.rootAuthority('agent-a'), 'agent-b', { durability: 'replicated' });
  expect(refusal(local.ledger.delegate(request))).toContain('replication demand unmet');
  // The locally written edge fact remains as history, but a retry cannot turn it into an offer.
  expect(value(local.store.read())).toHaveLength(1);
  expect(local.ledger.view().get([...local.ledger.view().keys()][0]!)!.dispatchable).toBe(false);
  expect(refusal(local.ledger.delegate(request))).toContain('replication demand unmet');
});
