import type ts from 'typescript';
export const DETECTOR_MODULES: readonly string[];
export function createProgram(extra?: Record<string, string>): ts.Program;
export function lintProgram(program: ts.Program, files: string[], detectors?: readonly string[]): { file: string; line: number; rule: string; detail: string }[];
