// Unit U1: the durable promotion record (Rules 38, 72, 73). Each structural rule is shown on both sides.
import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { PROMOTION_RECORD, promotionOf, promotionRecordFindings, utcDay } from './promotion-record.js';
import type { PromotionEntry, StageReached } from './promotion-record.js';

const AT = 1790553600000;
const stage = (s: StageReached['stage'], fields: Partial<StageReached> = {}): PromotionEntry =>
  ({ capability: 'preview.x', decision: 'stage-reached', stage: s, evidence: 'proofs.jsonl#x', recordedAt: AT, by: 'desk', ...fields });
const deadline = (fields: Partial<Extract<PromotionEntry, { decision: 'new-deadline' }>> = {}): PromotionEntry =>
  ({ capability: 'preview.x', decision: 'new-deadline', deadline: AT + 1, reason: 'r', owner: 'o', rollback: 'b', recordedAt: AT, by: 'desk', ...fields });

describe('the promotion record', () => {
  it('the committed record is well formed and moves step-check to a recorded, not overdue, deadline', () => {
    expect(promotionRecordFindings(PROMOTION_RECORD)).toEqual([]);
    const step = promotionOf(PROMOTION_RECORD, 'preview.step-check');
    expect(step.deadline).toMatchObject({ deadline: Date.UTC(2026, 9, 15), recordedAt: Date.UTC(2026, 8, 28) });
    expect(step.deadline!.deadline).toBeGreaterThan(Date.UTC(2026, 8, 30));
    // No stage is claimed without evidence: the live trace has not been recorded.
    expect(step.stages).toEqual({ 'test-agent': null, 'development-agent': null, fleet: null });
    expect(existsSync('tests/preview/jev-step-supervisor-live-test.md')).toBe(true);
  });
  it('stages are reached in order, once, with evidence', () => {
    expect(promotionRecordFindings([stage('test-agent'), stage('development-agent'), stage('fleet')])).toEqual([]);
    expect(promotionRecordFindings([stage('development-agent')]).join('\n')).toMatch(/development-agent is reached only after test-agent/u);
    expect(promotionRecordFindings([stage('test-agent'), stage('fleet')]).join('\n')).toMatch(/fleet is reached only after test-agent and development-agent/u);
    expect(promotionRecordFindings([stage('test-agent'), stage('test-agent')]).join('\n')).toMatch(/test-agent is recorded once/u);
    expect(promotionRecordFindings([stage('test-agent', { evidence: ' ' })]).join('\n')).toMatch(/names the durable evidence/u);
    // Order is per capability: another capability's stage does not satisfy this one's.
    expect(promotionRecordFindings([stage('test-agent', { capability: 'preview.y' }), stage('development-agent')]).join('\n')).toMatch(/only after test-agent/u);
  });
  it('a new deadline lies after its recording and names reason, owner and rollback; the record is time-ordered', () => {
    expect(promotionRecordFindings([deadline()])).toEqual([]);
    expect(promotionRecordFindings([deadline({ deadline: AT })]).join('\n')).toMatch(/lies after the moment it is recorded/u);
    expect(promotionRecordFindings([deadline({ owner: '' })]).join('\n')).toMatch(/reason, owner and rollback/u);
    expect(promotionRecordFindings([deadline({ rollback: '' })]).join('\n')).toMatch(/reason, owner and rollback/u);
    expect(promotionRecordFindings([deadline({ recordedAt: AT + 5, deadline: AT + 9 }), deadline()]).join('\n')).toMatch(/append-only in time order/u);
    expect(promotionRecordFindings([deadline({ by: '' })]).join('\n')).toMatch(/who recorded it/u);
  });
  it('the latest deadline and each recorded stage win for their own capability only', () => {
    const record = [deadline(), stage('test-agent', { evidence: 'e1', recordedAt: AT + 1 }), deadline({ deadline: AT + 50, recordedAt: AT + 2, reason: 'later' }),
      stage('test-agent', { capability: 'preview.y' })];
    expect(promotionOf(record, 'preview.x')).toEqual({ stages: { 'test-agent': { evidence: 'e1', recordedAt: AT + 1 }, 'development-agent': null, fleet: null },
      deadline: { deadline: AT + 50, recordedAt: AT + 2, reason: 'later', owner: 'o' } });
    expect(promotionOf(record, 'preview.z')).toEqual({ stages: { 'test-agent': null, 'development-agent': null, fleet: null }, deadline: null });
  });
  it('formats UTC days without an ambient clock', () => {
    for (const ms of [0, Date.UTC(2000, 1, 29), Date.UTC(2026, 8, 30), Date.UTC(2026, 9, 15, 23, 59), Date.UTC(2100, 2, 1), Date.UTC(1969, 11, 31, 12)])
      expect(utcDay(ms), String(ms)).toBe(new Date(ms).toISOString().slice(0, 10));
  });
});
