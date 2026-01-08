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
    let finalProgress = data.progress ?? 0;
    let earliestStart: Date | null = null;
    let latestEnd: Date | null = null;
    let totalWeightedProgress = 0;
    let totalWeight = 0;

    const calculateWeightedProgress = (tasks: any[], level: number) => {
        let levelWeightedProgress = 0;
        let levelTotalWeight = 0;

        tasks.forEach(task => {
            const hasChildren = (level === 0 && task.hasSubTasks === 'yes' && task.subTasks) || 
                                (level === 1 && task.hasSubOfSubTasks === 'yes' && task.subOfSubTasks);
            
            if (hasChildren) {
                const children = level === 0 ? task.subTasks : task.subOfSubTasks;
                const { weightedProgress: childrenWeightedProgress, totalWeight: childrenTotalWeight } = calculateWeightedProgress(children, level + 1);
                
                if (childrenTotalWeight > 0) {
                    task.progress = childrenWeightedProgress / childrenTotalWeight;
                } else {
                    task.progress = 0;
                }

                // Roll up dates
                let taskEarliestStart: Date | null = null;
                let taskLatestEnd: Date | null = null;
                children.forEach((child: any) => {
                    const childStart = dayjs(child.start).toDate();
                    const childEnd = dayjs(child.end).toDate();
                    if (!taskEarliestStart || childStart < taskEarliestStart) taskEarliestStart = childStart;
                    if (!taskLatestEnd || childEnd > taskLatestEnd) taskLatestEnd = childEnd;
                });
                task.start = dayjs(taskEarliestStart).format('YYYY-MM-DD');
                task.end = dayjs(taskLatestEnd).format('YYYY-MM-DD');
                
            } else {
                task.start = `${task.startYear}-${String(task.startMonth).padStart(2, '0')}-${String(task.startDay).padStart(2, '0')}`;
                task.end = `${task.endYear}-${String(task.endMonth).padStart(2, '0')}-${String(task.endDay).padStart(2, '0')}`;
            }
            
            const workingDays = calculateWorkingDays(task.start, task.end);
            levelWeightedProgress += (task.progress || 0) * workingDays;
            levelTotalWeight += workingDays;

            // Also track earliest/latest for the top-level parent
            const taskStart = dayjs(task.start).toDate();
            const taskEnd = dayjs(task.end).toDate();
            if (!earliestStart || taskStart < earliestStart) earliestStart = taskStart;
            if (!latestEnd || taskEnd > latestEnd) latestEnd = taskEnd;
        });

        return { weightedProgress: levelWeightedProgress, totalWeight: levelTotalWeight };
    };

    if (data.hasSubTasks === 'yes' && data.subTasks && data.subTasks.length > 0) {
        const result = calculateWeightedProgress(data.subTasks, 1);
        totalWeightedProgress = result.weightedProgress;
        totalWeight = result.totalWeight;

        if (totalWeight > 0) {
            finalProgress = totalWeightedProgress / totalWeight;
        }
    }

    return {
        ...data,
        progress: finalProgress,
        start: earliestStart ? dayjs(earliestStart).format('YYYY-MM-DD') : `${data.startYear}-${String(data.startMonth).padStart(2, '0')}-${String(data.startDay).padStart(2, '0')}`,
        end: latestEnd ? dayjs(latestEnd).format('YYYY-MM-DD') : `${data.endYear}-${String(data.endMonth).padStart(2, '0')}-${String(data.endDay).padStart(2, '0')}`
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
