import type { Task } from './catalog.mjs';
export interface Request {
  id: string; model: string; fixtures: Record<string, string>; boundary: string;
  [key: string]: unknown;
}
export interface Cost { id: string; part: string; tokens: number | null; calls: number | null; wallMs: number | null; evidence: string }
export interface Result {
  requestId: string; model: string; state: string; observation: Record<string, unknown>;
  evidence: string[]; breaches: string[]; totals: { tokens: number | null; calls: number | null };
  costs: Cost[]; wallMs?: number;
}
export interface Grade {
  reviewer: string; resultDigest: string; correctness: string; trust: Record<string, string>;
  reason: string; evidence: string[]; cost: Omit<Cost, 'id' | 'part'>;
}
export interface GradePacket { task: Task; result: Result; requestId?: string; history?: object[]; finalStage?: boolean; remainingCalls?: number }
export interface Driver { execute(request: Request, options?: { signal: AbortSignal }): Promise<Result> }
export interface Grader { grade(packet: GradePacket, options?: { signal: AbortSignal }): Promise<Grade> }
export const setups: string[];
export function digest(value: unknown): string;
export function durable(path: string, value: unknown): void;
export function validateConfig<T extends object>(config: T): T;
export function initialize(root: string, config: object): void;
export function validateResult(result: unknown, request: Request, wallMs: number): Result;
export function validateGrade(grade: unknown, task: Task, result: unknown): Grade;
export function runDay(root: string, day: number, driver: Driver, grader: Grader, now?: () => number): Promise<void>;
export function recordedObservation(row: object): { id: unknown; kind: string; digest: string; state: string; output: unknown; usage: unknown };
export function table(rows: object[]): string;
export function partVerdict(part: string, baseline: object[], ablated: object[], judgment: { verdict: string; reason: string; evidence: string[] }): { part: string; kind: string; verdict: string; reason: string; evidence: string[] };
