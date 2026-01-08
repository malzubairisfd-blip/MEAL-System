// types/gantt.ts
import { z } from 'zod';

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
    let finalProgress = data.progress ?? 0;
    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;

    if (data.hasSubTasks === 'yes' && data.subTasks && data.subTasks.length > 0) {
        const transformedSubTasks = data.subTasks.map(st => {
            if (st.hasSubOfSubTasks === 'yes' && st.subOfSubTasks && st.subOfSubTasks.length > 0) {
                 let subEarliest: Date | null = null;
                 let subLatest: Date | null = null;
                 st.subOfSubTasks.forEach(sst => {
                    const sstStart = new Date(Number(sst.startYear), Number(sst.startMonth) - 1, Number(sst.startDay));
                    const sstEnd = new Date(Number(sst.endYear), Number(sst.endMonth) - 1, Number(sst.endDay));
                    if (!subEarliest || sstStart < subEarliest) subEarliest = sstStart;
                    if (!subLatest || sstEnd > subLatest) subLatest = sstEnd;
                 });
                 const subProgress = st.subOfSubTasks.reduce((acc, sst) => acc + (sst.progress || 0), 0) / (st.subOfSubTasks.length || 1);
                 return { 
                     ...st, 
                     start: subEarliest!.toISOString().split('T')[0], 
                     end: subLatest!.toISOString().split('T')[0],
                     progress: subProgress
                };
            }
            return {
                ...st,
                start: `${st.startYear}-${String(st.startMonth).padStart(2, '0')}-${String(st.startDay).padStart(2, '0')}`,
                end: `${st.endYear}-${String(st.endMonth).padStart(2, '0')}-${String(st.endDay).padStart(2, '0')}`
            };
        });

        transformedSubTasks.forEach(st => {
            const subStart = new Date(st.start as string);
            const subEnd = new Date(st.end as string);
            if (!earliestStart || subStart < earliestStart) earliestStart = subStart;
            if (!latestEnd || subEnd > latestEnd) latestEnd = subEnd;
        });

        finalProgress = transformedSubTasks.reduce((acc, st) => acc + (st.progress || 0), 0) / (transformedSubTasks.length || 1);
        data.subTasks = transformedSubTasks;
    }

    return {
        ...data,
        progress: finalProgress,
        start: earliestStart ? earliestStart.toISOString().split('T')[0] : `${data.startYear}-${String(data.startMonth).padStart(2, '0')}-${String(data.startDay).padStart(2, '0')}`,
        end: latestEnd ? latestEnd.toISOString().split('T')[0] : `${data.endYear}-${String(data.endMonth).padStart(2, '0')}-${String(data.endDay).padStart(2, '0')}`
    };
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