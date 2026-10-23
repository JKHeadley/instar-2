export interface Stage { day: number; topic: string; boundary: string; prompt: string | null }
export interface Task {
  id: string; sources: object[]; stages: Stage[]; expected: string; rubric: string;
  trust: string[]; fixtures: Record<string, string>; category: string; adaptation: string;
}
export interface Part { id: string; kind: string; purpose?: string; source?: string; failure?: string; switchOff?: string }
export const tasks: Task[];
export const parts: Part[];
export const trustDimensions: string[];
