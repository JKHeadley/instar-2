import { expect, it } from 'vitest';
import { credentialDisplayLabel } from './credential-display.js';
import { publicCredentialRegister } from './reply-check.js';
import { dueCredentialReminders, reminderSchedule, type CredentialRecord } from './secret-custody.js';
import { credentialNotices } from './credential-reminders.js';

it('uses display labels in reminders and model facts while keeping legacy keys and account identity', () => {
  const record: CredentialRecord = { name: 'preview-harness-profile-justin-gmail-v1', kind: 'subscription-login',
    identity: 'headley.justin@gmail.com', custody: 'cli-custody', recordedAt: 1, expiresAt: 1000,
    expirySource: 'unknown', reminders: reminderSchedule(1000),
    renewal: { standing: 'none', smallestHumanAction: 'sign the subscription login back in' } };
  for (const entry of [record, { ...record, displayLabel: 'your work subscription sign-in' }]) {
    const label = entry.displayLabel ?? 'your Claude subscription sign-in (headley.justin@gmail.com)';
    expect(credentialDisplayLabel(entry)).toBe(label);
    const due = dueCredentialReminders([entry], 100);
    expect(due[0]!.name).toBe(record.name);
    const notice = credentialNotices(due, 100)[0]!;
    expect(notice.key).toContain(record.name);
    expect(notice.line).toContain(label);
    expect(notice.line).not.toContain('preview');
    const facts = publicCredentialRegister([entry], [], 100);
    expect(facts[0]).toMatchObject({ name: label, identity: label });
    expect(JSON.stringify(facts)).not.toContain(record.name);
  }
  expect(record.identity).toBe('headley.justin@gmail.com');
  expect(credentialDisplayLabel({ kind: 'unrecognized', identity: 'internal-ref' })).toBe('your stored credential');
  expect(credentialDisplayLabel({ ...record, displayLabel: ' ' })).toBe(credentialDisplayLabel(record));
  expect(publicCredentialRegister([{ ...record, displayLabel: 'held-secret' }], ['held-secret'], 100)).toEqual([]);
});
