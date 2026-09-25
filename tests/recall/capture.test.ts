import { describe, expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { refused } from '../facts/fixtures.js';
import { secretShape } from '../../src/facts/index.js';
import { captureExchange, readExchange, redact, redactionMark } from '../../src/recall/index.js';
import { recallFixture } from './fixture.js';

describe('recall capture — exchanges become durable part-two facts', () => {
  it('appends a signed recall-exchange fact with speaker, time, conversation and provenance', () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    const receipt = value(captureExchange(r.exchange({ text: 'Meet at the lighthouse on Friday' }), r.at(1000), w));
    expect(receipt).toMatchObject({ duplicate: false, redactions: 0, durability: { kind: 'local-durable' } });
    const facts = value(w.store.read());
    expect(facts).toHaveLength(1);
    const ex = readExchange(facts[0]!)!;
    expect(ex).toMatchObject({ factId: receipt.factId, at: 1000, conversation: 'telegram:-100:42', session: 'session-a',
      speakerId: 'justin', speakerName: 'Justin', speakerRole: 'user', text: 'Meet at the lighthouse on Friday',
      visibility: 'participants', audience: ['justin'], machine: 'machine-a' });
    expect(facts[0]!.principal).toMatchObject({ id: 'alice' });
    expect(storage.rows).toHaveLength(1);
  });

  it('is idempotent on (conversation, messageId): a redelivery appends nothing', () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    const first = value(captureExchange(r.exchange(), r.at(1000), w));
    const again = value(captureExchange(r.exchange(), r.at(2000), w));
    expect(again).toMatchObject({ factId: first.factId, duplicate: true, durability: { kind: 'already-recorded' } });
    expect(storage.rows).toHaveLength(1);
    // Same message id in another conversation is a different exchange.
    value(captureExchange(r.exchange({ conversation: 'telegram:-100:7' }), r.at(2000), w));
    expect(storage.rows).toHaveLength(2);
  });

  it('refuses a reused message id with different content as an integrity signal', () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    value(captureExchange(r.exchange(), r.at(1000), w));
    expect(refused(captureExchange(r.exchange({ text: 'changed' }), r.at(2000), w))).toContain('reused with different content');
    expect(storage.rows).toHaveLength(1);
  });

  it('never stores a credential: the exchange is kept, the secret is redacted', () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    const text = 'my key is sk-ant-abcdefghijklmnopqrstuvwxyz0123 and password=hunter22 ok';
    const receipt = value(captureExchange(r.exchange({ text }), r.at(1000), w));
    expect(receipt.redactions).toBe(2);
    expect(storage.rows.join('')).not.toContain('abcdefghijklmnopqrstuvwxyz0123');
    expect(storage.rows.join('')).not.toContain('hunter22');
    expect(readExchange(value(w.store.read())[0]!)!.text).toBe(`my key is ${redactionMark} and password=${redactionMark} ok`);
  });

  it('redaction covers every shape the envelope refuses, plus common tokens', () => {
    const samples = ['ghp_' + 'a'.repeat(36), 'AKIA' + 'B'.repeat(16), '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----',
      'xoxb-1234567890-abcdef', '123456789:' + 'A'.repeat(35), 'Bearer ' + 'x'.repeat(30), 'sk-' + 'z'.repeat(40),
      'github_pat_' + 'q'.repeat(30), 'eyJhbGciOiJI.eyJzdWIiOiIx.SflKxwRJSMeKK'];
    for (const s of samples) {
      const out = redact(`before ${s} after`);
      expect(out.count, s).toBeGreaterThan(0);
      expect(out.text).not.toContain(s);
      expect(secretShape(out.text)).toBe(false);
    }
    expect(redact('an ordinary sentence about tokens and keys').count).toBe(0);
  });

  it('validates the input before anything is appended', () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    refused(captureExchange(r.exchange({ speakerRole: 'boss' as never }), r.at(1000), w), 'speakerRole');
    refused(captureExchange(r.exchange({ visibility: 'participants', audience: [] }), r.at(1000), w), 'requires an audience');
    refused(captureExchange(r.exchange({ conversation: 'a\nb' }), r.at(1000), w), 'conversation');
    refused(captureExchange(r.exchange({ text: 'x'.repeat(8001) }), r.at(1000), w), 'text');
    expect(storage.rows).toHaveLength(0);
  });

  it('returns the store refusal when durable append fails (no silent success)', () => {
    const r = recallFixture();
    const storage = { ...r.memoryStorage(), append: () => r.fx.success({ kind: 'nothing' } as never) };
    const w = r.writer(storage);
    refused(captureExchange(r.exchange(), r.at(1000), w));
  });

  it('an unknown stored visibility reads as private, never wider', () => {
    const r = recallFixture(); const storage = r.memoryStorage(); const w = r.writer(storage);
    value(captureExchange(r.exchange(), r.at(1000), w));
    const fact = value(w.store.read())[0]!;
    const forged = { ...fact, body: { ...(fact.body as object), visibility: 'everyone' } } as typeof fact;
    expect(readExchange(forged)!.visibility).toBe('private');
  });
});
