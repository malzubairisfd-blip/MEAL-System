// types/gantt.ts
import { z } from 'zod';
import dayjs from "dayjs";
import { calculateWorkingDays } from '@/lib/ganttUtils';


export type TaskStatus =
  | "DONE"
  | "IN_PROGRESS"
  | "PLANNED"
  | "BLOCKED"
  | "EXPECTS_PLANNING";

export const SubOfSubTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required.").max(100),
  startDay: z.string().min(1, "Start day is required."),
  startMonth: z.string().min(1, "Start month is required."),
  startYear: z.string().min(1, "Start year is required."),
  endDay: z.string().min(1, "End day is required."),
  endMonth: z.string().min(1, "End month is required."),
  endYear: z.string().min(1, "End year is required."),
  progress: z.coerce.number().min(0).max(100).default(0),
  status: z.enum(["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"]).default("PLANNED"),
}).refine(data => {
    const start = new Date(Number(data.startYear), Number(data.startMonth) - 1, Number(data.startDay));
    const end = new Date(Number(data.endYear), Number(data.endMonth) - 1, Number(data.endDay));
    return end >= start;
}, {
    message: "End date must be after or the same as start date.",
    path: ["endDay"],
});

export const SubTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Sub-task title is required.").max(100),
  hasSubOfSubTasks: z.enum(['yes', 'no']),
  startDay: z.string().optional(),
  startMonth: z.string().optional(),
  startYear: z.string().optional(),
  endDay: z.string().optional(),
  endMonth: z.string().optional(),
  endYear: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"]).default("PLANNED"),
  subOfSubTasks: z.array(SubOfSubTaskSchema).optional(),
}).refine(data => {
    if (data.hasSubOfSubTasks === 'no') {
        return data.startDay && data.startMonth && data.startYear && data.endDay && data.endMonth && data.endYear;
    }
    return true;
}, {
    message: "Start and end dates are required for sub-tasks without children.",
    path: ["startDay"],
}).refine(data => {
    if (data.hasSubOfSubTasks === 'no' && data.startYear && data.startMonth && data.startDay && data.endYear && data.endMonth && data.endDay) {
        const start = new Date(Number(data.startYear), Number(data.startMonth) - 1, Number(data.startDay));
        const end = new Date(Number(data.endYear), Number(data.endMonth) - 1, Number(data.endDay));
        return end >= start;
    }
    return true;
}, {
    message: "End date must be after or the same as start date.",
    path: ["endDay"],
}).refine(data => {
    if (data.hasSubOfSubTasks === 'yes') {
        return data.subOfSubTasks && data.subOfSubTasks.length > 0;
    }
    return true;
}, {
    message: "Please add at least one sub-of-sub-task.",
    path: ["subOfSubTasks"],
});

export const GanttTaskSchema = z.object({
    id: z.string(),
    title: z.string().min(1, "Title is required.").max(100),
    startDay: z.string().optional(),
    startMonth: z.string().optional(),
    startYear: z.string().optional(),
    endDay: z.string().optional(),
    endMonth: z.string().optional(),
    endYear: z.string().optional(),
    progress: z.coerce.number().min(0).max(100).optional(),
    status: z.enum(["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"]).default("PLANNED"),
    hasSubTasks: z.enum(['yes', 'no']),
    subTasks: z.array(SubTaskSchema).optional(),
}).refine(data => {
    if (data.hasSubTasks === 'no') {
        return data.startDay && data.startMonth && data.startYear && data.endDay && data.endMonth && data.endYear;
    }
    return true;
}, {
    message: "Start and end dates are required for tasks without sub-tasks.",
    path: ["startDay"], 
}).refine(data => {
    if (data.hasSubTasks === 'no' && data.startYear && data.startMonth && data.startDay && data.endYear && data.endMonth && data.endDay) {
        const start = new Date(Number(data.startYear), Number(data.startMonth) - 1, Number(data.startDay));
        const end = new Date(Number(data.endYear), Number(data.endMonth) - 1, Number(data.endDay));
        return end >= start;
    }
    return true;
}, {
    message: "End date must be after or the same as start date.",
    path: ["endDay"],
}).refine(data => {
    if (data.hasSubTasks === 'yes') {
        return data.subTasks && data.subTasks.length > 0;
    }
    return true;
}, {
    message: "Please add at least one sub-task.",
    path: ["subTasks"],
}).transform(data => {
    const getDates = (task: any): { start: Date | null, end: Date | null } => {
        if (task.start && task.end) return { start: dayjs(task.start).toDate(), end: dayjs(task.end).toDate() };
        if (task.startYear && task.startMonth && task.startDay && task.endYear && task.endMonth && task.endDay) {
            return {
                start: dayjs(`${task.startYear}-${task.startMonth}-${task.startDay}`).toDate(),
                end: dayjs(`${task.endYear}-${task.endMonth}-${task.endDay}`).toDate()
            };
        }
        return { start: null, end: null };
    };

    const processTasks = (tasks: any[]): { earliest: Date | null, latest: Date | null, totalWeightedProgress: number, totalWeight: number } => {
        let earliest: Date | null = null;
        let latest: Date | null = null;
        let totalWeightedProgress = 0;
        let totalWeight = 0;

        tasks.forEach(task => {
            let childTasks: any[] | undefined;
            if ('subTasks' in task && task.hasSubTasks === 'yes') {
                childTasks = task.subTasks;
            } else if ('subOfSubTasks' in task && task.hasSubOfSubTasks === 'yes') {
                childTasks = task.subOfSubTasks;
            }

            if (childTasks && childTasks.length > 0) {
                const result = processTasks(childTasks);
                task.start = result.earliest ? dayjs(result.earliest).format('YYYY-MM-DD') : task.start;
                task.end = result.latest ? dayjs(result.latest).format('YYYY-MM-DD') : task.end;
                task.progress = result.totalWeight > 0 ? result.totalWeightedProgress / result.totalWeight : 0;
            } else {
                 const dates = getDates(task);
                 if (dates.start) task.start = dayjs(dates.start).format('YYYY-MM-DD');
                 if (dates.end) task.end = dayjs(dates.end).format('YYYY-MM-DD');
            }

            const { start, end } = getDates(task);
            if (start && (!earliest || start < earliest)) earliest = start;
            if (end && (!latest || end > latest)) latest = end;

            const workingDays = calculateWorkingDays(task.start, task.end);
            totalWeightedProgress += (task.progress || 0) * workingDays;
            totalWeight += workingDays;
        });

        return { earliest, latest, totalWeightedProgress, totalWeight };
    };

    if (data.hasSubTasks === 'yes' && data.subTasks && data.subTasks.length > 0) {
        const result = processTasks(data.subTasks);
        data.start = result.earliest ? dayjs(result.earliest).format('YYYY-MM-DD') : data.start;
        data.end = result.latest ? dayjs(result.latest).format('YYYY-MM-DD') : data.end;
        data.progress = result.totalWeight > 0 ? result.totalWeightedProgress / result.totalWeight : 0;
    } else {
        const dates = getDates(data);
        if (dates.start) data.start = dayjs(dates.start).format('YYYY-MM-DD');
        if (dates.end) data.end = dayjs(dates.end).format('YYYY-MM-DD');
    }

    return data;
});


export interface GanttTask {
  id: string;
  title: string;
  start: string;
  end: string;
  status: TaskStatus;
  progress: number;
  parentId?: string;
  hasSubTasks: 'yes' | 'no';
  subTasks?: GanttSubTask[];
}

export interface GanttSubTask extends Omit<GanttTask, 'subTasks' | 'hasSubTasks'> {
  hasSubOfSubTasks: 'yes' | 'no';
  subOfSubTasks?: GanttSubOfSubTask[];
}

export interface GanttSubOfSubTask extends Omit<GanttTask, 'subTasks' | 'hasSubTasks' | 'parentId'> {}

export type GanttTaskFormValues = z.infer<typeof GanttTaskSchema>;
export type SubTaskFormValues = z.infer<typeof SubTaskSchema>;
export type SubOfSubTaskFormValues = z.infer<typeof SubOfSubTaskSchema>;
