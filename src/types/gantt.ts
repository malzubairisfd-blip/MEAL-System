// types/gantt.ts
import { z } from 'zod';

export type TaskStatus =
  | "DONE"
  | "IN_PROGRESS"
  | "PLANNED"
  | "BLOCKED"
  | "EXPECTS_PLANNING";

export const SubTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Sub-task title is required.").max(100),
});

export const GanttTaskSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required.").max(100),
    startMonth: z.string().min(1, "Start month is required."),
    startYear: z.string().min(1, "Start year is required."),
    endMonth: z.string().min(1, "End month is required."),
    endYear: z.string().min(1, "End year is required."),
    status: z.enum(["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"]),
    hasSubTasks: z.enum(['yes', 'no']),
    subTasks: z.array(SubTaskSchema).optional(),
}).refine(data => {
    const start = new Date(Number(data.startYear), Number(data.startMonth) - 1);
    const end = new Date(Number(data.endYear), Number(data.endMonth) -1);
    return end >= start;
}, {
    message: "End date must be after or the same as start date.",
    path: ["endMonth"],
}).refine(data => {
    if (data.hasSubTasks === 'yes') {
        return data.subTasks && data.subTasks.length > 0;
    }
    return true;
}, {
    message: "Please add at least one sub-task.",
    path: ["subTasks"],
}).transform(data => ({
    ...data,
    start: `${data.startYear}-${data.startMonth.padStart(2, '0')}-01`,
    end: `${data.endYear}-${data.endMonth.padStart(2, '0')}-${new Date(Number(data.endYear), Number(data.endMonth), 0).getDate()}`
}));

export interface GanttTask {
  id: string;
  title: string;
  start: string;
  end: string;
  status: TaskStatus;
  parentId?: string;
  subTasks?: { id: string; title: string; }[];
  // Form-only fields
  startMonth?: string;
  startYear?: string;
  endMonth?: string;
  endYear?: string;
  hasSubTasks?: 'yes' | 'no';
}

export type GanttTaskFormValues = z.infer<typeof GanttTaskSchema>;
