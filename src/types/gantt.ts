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
  startMonth: z.string().min(1, "Start month is required."),
  startYear: z.string().min(1, "Start year is required."),
  endMonth: z.string().min(1, "End month is required."),
  endYear: z.string().min(1, "End year is required."),
});

export const GanttTaskSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required.").max(100),
    startMonth: z.string().optional(),
    startYear: z.string().optional(),
    endMonth: z.string().optional(),
    endYear: z.string().optional(),
    status: z.enum(["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"]),
    hasSubTasks: z.enum(['yes', 'no']),
    subTasks: z.array(SubTaskSchema).optional(),
}).refine(data => {
    if (data.hasSubTasks === 'no') {
        return data.startMonth && data.startYear && data.endMonth && data.endYear;
    }
    return true;
}, {
    message: "Start and end dates are required for tasks without sub-tasks.",
    path: ["startMonth"], 
}).refine(data => {
    if (data.hasSubTasks === 'no' && data.startYear && data.startMonth && data.endYear && data.endMonth) {
        const start = new Date(Number(data.startYear), Number(data.startMonth) - 1);
        const end = new Date(Number(data.endYear), Number(data.endMonth) -1);
        return end >= start;
    }
    return true;
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
}).transform(data => {
    if (data.hasSubTasks === 'yes' && data.subTasks && data.subTasks.length > 0) {
        // Auto-calculate main task dates from sub-tasks
        let earliestStart = new Date(Number(data.subTasks[0].startYear), Number(data.subTasks[0].startMonth) - 1);
        let latestEnd = new Date(Number(data.subTasks[0].endYear), Number(data.subTasks[0].endMonth) - 1);

        data.subTasks.forEach(st => {
            const subStart = new Date(Number(st.startYear), Number(st.startMonth) - 1);
            const subEnd = new Date(Number(st.endYear), Number(st.endMonth) - 1);
            if (subStart < earliestStart) earliestStart = subStart;
            if (subEnd > latestEnd) latestEnd = subEnd;
        });

        return {
            ...data,
            start: earliestStart.toISOString().split('T')[0],
            end: new Date(latestEnd.getFullYear(), latestEnd.getMonth() + 1, 0).toISOString().split('T')[0],
            subTasks: data.subTasks.map(st => ({
              ...st,
              start: `${st.startYear}-${st.startMonth.padStart(2, '0')}-01`,
              end: `${st.endYear}-${st.endMonth.padStart(2, '0')}-${new Date(Number(st.endYear), Number(st.endMonth), 0).getDate()}`
            }))
        }
    }

    return {
        ...data,
        start: `${data.startYear}-${String(data.startMonth).padStart(2, '0')}-01`,
        end: `${data.endYear}-${String(data.endMonth).padStart(2, '0')}-${new Date(Number(data.endYear), Number(data.endMonth), 0).getDate()}`
    };
});


export interface GanttTask {
  id: string;
  title: string;
  start: string;
  end: string;
  status: TaskStatus;
  parentId?: string;
  hasSubTasks: 'yes' | 'no';
  subTasks?: GanttTask[]; // Subtasks are also GanttTasks
}

export type GanttTaskFormValues = z.infer<typeof GanttTaskSchema>;
