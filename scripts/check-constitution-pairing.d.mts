// Types for the plain Node script, used by its tests.
export const INSTAR: string;
export const INSTAR_2: string;
export const WINDOW_MS: number;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Any = any;
export function touchesBook(repo: string, files: string[]): boolean;
export function parseDeclaration(body: unknown): Any;
export function pairProblem(repo: string, declaration: Any, counterpart: Any): string | null;
export function checkPr(repo: string, body: unknown, read: Any): Any;
export function classifyMerged(input: Any): Any;
export function readPr(repo: string, number: number, deps?: Any): Any;
export function runDaily(input?: Any): Any;
export function summarize(report: Any): Any;
export function pairingRefusal(repo: string, number: number, read?: Any): Any;
