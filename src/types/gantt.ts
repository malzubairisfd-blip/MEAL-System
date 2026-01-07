// types/gantt.ts
export type TaskStatus =
  | "DONE"
  | "IN_PROGRESS"
  | "PLANNED"
  | "BLOCKED"
  | "EXPECTS_PLANNING";

export interface GanttTask {
  id: string;
  title: string;
  start: string; // ISO date
  end: string;   // ISO date
  status: TaskStatus;
  parentId?: string;
}
