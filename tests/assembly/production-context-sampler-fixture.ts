// @ts-nocheck -- R5 offline grounding fixture over the real Five/Ten/Eight/Six live-input owners.
// Test-only authority: the v2 briefing schema, the approval and the audience below are
// SYNTHETIC offline stand-ins for R4's real package/operator acceptance. Nothing here
// is installed evidence.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { canonical } from '../../src/index.js';
import { hashBytes } from '../../src/facts/index.js';
import { createProductionGroundingReader } from '../../src/assembly/index.js';
import { createRunGraph } from '../../src/rungraph/index.js';
import { buildGroundingBriefingBody, createProductionContextSampler, renderGroundedContext } from '../../src/assembly/production-context-sampler.js';
import { createLiveInputAssemblyFixture, ref, value, json } from './live-input-owner-fixture.js';

export const SYNTHETIC_APPROVAL = 'approval:r5-offline-synthetic';
export const INSTALLATION = 'installation:r5-offline';
export const ROUTE = 'route';
const root = new URL('../../', import.meta.url);
const text = (maxLength: number) => ({ kind: 'text', maxLength });

/** Exact excerpt of an approved source document with path + git blob revision,
 * preserved whole-source bytes in Two capture custody, and a byte-range selector. */
export function documentExcerpt(f, path: string, from: string, through: string) {
  const bytes = readFileSync(new URL(path, root), 'utf8');
  const start = bytes.indexOf(from), end = bytes.indexOf(through, start) + through.length;
  if (start < 0 || end < start + through.length) throw Error(`excerpt anchors absent in ${path}`);
  const content = bytes.slice(start, end);
  const revision = execFileSync('git', ['rev-parse', `HEAD:${path}`], { cwd: root, encoding: 'utf8' }).trim();
  const capture = value(f.owners.host.capture(bytes));
  const byteStart = Buffer.byteLength(bytes.slice(0, start));
  return { content, source: { path, revision, capture: capture.reference, hash: capture.hash,
    selector: `utf8-bytes:${byteStart}-${byteStart + Buffer.byteLength(content)}`, facts: [] } };
}

export const PURPOSE = ['docs/00-the-purpose.md', '> **Make the world', '> **Make coherence something an AI cannot lose.**'] as const;
export const CONTRACT = ['docs/14-the-assembly/16-the-fixed-single-machine-installation-contract.md',
  '**Status: draft, awaiting operator approval.**', 'approval, clock, and observation host.'] as const;

export function groundingFixture(options: { storage?: any; purpose?: any; status?: any; audience?: string[] } = {}) {
  const f = createLiveInputAssemblyFixture(options.storage, { minimal: true });
  const p = f.groundingFor({ scope: 'scope:minimal' });
  // Test-only registration of the granted { class, content } briefing body. No src
  // owner registers this kind; R4's package must bind the real schema. `content` is
  // optional only so the fixture's pre-existing class-only rows stay decodable.
  Object.assign(f.ctx, { schemas: f.ctx.schemas.map(schema => schema.kind === 'rungraph-briefing-material'
    ? { ...schema, fields: { class: text(2048), content: text(65536) }, optional: ['content'] } : schema) });
  const at = () => f.deps.clock().value;
  const item = (id, kind, extra) => ({ id, kind, scope: INSTALLATION, audience: options.audience ?? ['bob', ROUTE],
    standing: { approval: SYNTHETIC_APPROVAL, version: 'r5-offline-v1', synthetic: true },
    observedAt: at(), effectiveAt: at(), ...extra,
    selectedHash: hashBytes(extra.content) });
  const derived = (facts: string[]) => ({ path: '', revision: '', capture: '', hash: '', selector: '', facts });
  const purpose = options.purpose ?? documentExcerpt(f, ...PURPOSE);
  const contract = documentExcerpt(f, ...CONTRACT);
  const statusContent = options.status ?? value(canonical({ installation: INSTALLATION, generation: f.run.generation.id,
    scope: 'reply-only', durability: 'local-durable', disposition: 'prepared',
    held: ['production-context-sampling', 'conversation-driver', 'activation-probe-evidence'],
    notObserved: ['live-telegram-delivery'], evidenceTier: 'synthetic-offline' })).bytes;
  const corpus = {
    identity: [item('purpose:1', 'purpose', purpose)],
    rules: [item('contract:1', 'contract', contract)],
    directives: [item('directive:1', 'directive', { content: 'Operator constraint: answer in at most two sentences.',
      source: derived([f.opening.id]) })],
    'pending-work': [item('status:1', 'installation-status', { content: statusContent,
      source: derived([f.launchFact.id, f.effects.leaseFact.id]) })],
  };
  const kinds = { identity: ['purpose'], rules: ['contract'], directives: ['directive'], 'pending-work': ['installation-status'] };
  const appendBody = (className: string, items = corpus[className]) => {
    const body = value(buildGroundingBriefingBody(className, items, p.context));
    return f.append('rungraph-briefing-material', json(body)).fact;
  };
  const bodies = Object.fromEntries(f.deps.groundingPolicy.briefingClasses.map(c => [c, appendBody(c)]));
  const captures = { read: (reference: string) => {
    const capture = f.ctx.captures[reference];
    return capture?.status === 'available' ? capture.bytes : null;
  } };
  let turn = 1;
  const plan: any = { run: f.id, opening: f.opening.id, step: 'step:operation:1', installation: INSTALLATION,
    generation: f.run.generation.id, audience: { principal: 'bob', route: ROUTE }, launch: f.launchFact.id,
    executionContext: f.effects.leaseFact.id, stimulusKinds: ['stimulus', 'next-inbound'], frontier: [f.opening.id], replies: [],
    briefing: f.deps.groundingPolicy.briefingClasses.map(c => ({ class: c, fact: bodies[c].id, digest: bodies[c].contentHash, kinds: kinds[c] })),
    approvals: [SYNTHETIC_APPROVAL], threshold: f.deps.groundingPolicy.threshold, statusMaxAge: 1000,
    previousActivity: f.deps.clock() };
  const events: string[] = [];
  const sample = createProductionContextSampler({ store: f.store, runtime: p.runtime, context: p.context, captures,
    plan: () => { events.push('plan'); return plan; },
    admitDelivery: ({ capture }) => {
      const admitted = f.effects.prepare(JSON.parse(captures.read(capture.reference)));
      return { operation: admitted.operation, claim: admitted.claim };
    } });
  const reader = createProductionGroundingReader({ scope: 'scope:minimal', runtime: p.runtime, harness: p.harness,
    context: p.context, clock: p.clock, sample });
  const graph = value(createRunGraph({ ...p.graphDependencies, store: p.spine.store, assemblyHistory: p.history, grounding: reader }));
  /** The exact delivery + consumption facts of the most recent grounded read. */
  const delivered = () => {
    const rows = value(p.runtime.inspectCurrent());
    const delivery = rows.filter(r => r.record.type === 'ContextDeliverySpecification').at(-1);
    const consumption = rows.filter(r => r.record.type === 'HarnessObservation' && r.record.contextDelivery === delivery?.fact.id
      && r.record.phase === 'context-consumed').at(-1);
    return { delivery: delivery.fact, specification: delivery.record, consumption: consumption.fact };
  };
  const bindings = (step = plan.step) => {
    const d = delivered();
    return { run: f.id, step, delivery: d.delivery.id, consumption: d.consumption.id,
      installation: INSTALLATION, generation: f.run.generation.id };
  };
  const render = (replies = plan.replies, step = plan.step) => renderGroundedContext({ store: f.store, context: p.context,
    captures, bindings: bindings(step), replies });
  /** Admit a distinct next operator input and advance the explicit frontier. */
  const nextInput = (label: string) => {
    const message = f.effects.message(f.id, label), capture = value(f.owners.host.capture(value(canonical(message)).bytes));
    const fact = f.append('next-inbound', json({ capture })).fact;
    plan.frontier = [...plan.frontier, fact.id];
    plan.step = `step:operation:${++turn}`;
    return fact;
  };
  return { ...f, p, plan, bodies, corpus, appendBody, captures, sample, reader, graph, delivered, bindings, render,
    nextInput, events, ref };
}
