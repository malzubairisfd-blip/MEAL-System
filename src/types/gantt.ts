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

// Base schema for a task, which will be used recursively
const BaseGanttTaskSchema = z.object({
  id: z.string(),
  title: z.string().min(1, "Title is required.").max(1000),
  startDay: z.string().optional(),
  startMonth: z.string().optional(),
  startYear: z.string().optional(),
  endDay: z.string().optional(),
  endMonth: z.string().optional(),
  endYear: z.string().optional(),
  progress: z.coerce.number().min(0).max(100).optional(),
  status: z.enum(["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"]).default("PLANNED"),
  hasSubTasks: z.enum(['yes', 'no']),
});

// Recursive schema definition
type GanttTaskType = z.infer<typeof BaseGanttTaskSchema> & {
  subTasks?: GanttTaskType[];
  start?: string;
  end?: string;
};

export const GanttTaskSchema: z.ZodType<GanttTaskType> = BaseGanttTaskSchema.extend({
  subTasks: z.lazy(() => z.array(GanttTaskSchema).optional()),
}).refine(data => {
    if (data.hasSubTasks === 'no') {
        return data.startDay && data.startMonth && data.startYear && data.endDay && data.endMonth && data.endYear;
    }
    return true;
}, {
    message: "Start and end dates are required for activities without sub-activities.",
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
    message: "Please add at least one sub-activity.",
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

    const processTask = (task: any) => {
        if (task.hasSubTasks === 'yes' && task.subTasks && task.subTasks.length > 0) {
            let earliest: Date | null = null;
            let latest: Date | null = null;
            let totalWeightedProgress = 0;
            let totalWeight = 0;

            task.subTasks.forEach((subTask: any) => {
                const processedSubTask = processTask(subTask);
                const { start, end } = getDates(processedSubTask);
                
                if (start && (!earliest || start < earliest)) earliest = start;
                if (end && (!latest || end > latest)) latest = end;

                const workingDays = calculateWorkingDays(processedSubTask.start, processedSubTask.end);
                totalWeightedProgress += (processedSubTask.progress || 0) * workingDays;
                totalWeight += workingDays;
            });
            
            task.start = earliest ? dayjs(earliest).format('YYYY-MM-DD') : undefined;
            task.end = latest ? dayjs(latest).format('YYYY-MM-DD') : undefined;
            task.progress = totalWeight > 0 ? totalWeightedProgress / totalWeight : 0;
        } else {
            const dates = getDates(task);
            if (dates.start) task.start = dayjs(dates.start).format('YYYY-MM-DD');
            if (dates.end) task.end = dayjs(dates.end).format('YYYY-MM-DD');
        }
        return task;
    };
    
    return processTask(data);
});

export type GanttTask = z.infer<typeof GanttTaskSchema>;
export type GanttTaskFormValues = z.infer<typeof GanttTaskSchema>;
