// components/gantt/GanttRow.tsx
"use client";

import dayjs from "dayjs";
import { GanttTask } from "@/types/gantt";
import { STATUS_COLORS } from "@/lib/statusStyles";
import { ChevronDown } from "lucide-react";

interface Props {
  task: GanttTask;
  projectStart: string;
  dayWidth: number;
}

export function GanttRow({ task, projectStart, dayWidth }: Props) {
  const offset = dayjs(task.start).diff(dayjs(projectStart), "day") * dayWidth;
  const duration = dayjs(task.end).diff(dayjs(task.start), "day") + 1;
  const width = duration * dayWidth;

  const statusText = task.status.replace(/_/g, " ");

  return (
    <div className="relative h-10 border-b border-slate-800">
      <div
        className="absolute h-6 top-2 rounded text-xs text-white px-2 flex items-center shadow-md"
        style={{
          left: offset,
          width,
          backgroundColor: STATUS_COLORS[task.status],
        }}
        title={`${task.title} (${task.start} → ${task.end})`}
      >
        <span className="truncate">{task.title}</span>
      </div>
    </div>
  );
}

const TaskStatusBadge = ({ status }: { status: TaskStatus }) => {
    const statusText = status.replace(/_/g, " ");
    return (
        <div
            className="flex items-center justify-center gap-1 rounded px-2 py-0.5 text-xs font-semibold"
            style={{ backgroundColor: STATUS_COLORS[status] + '33', color: STATUS_COLORS[status] }}
        >
            <span>{statusText}</span>
            <ChevronDown className="h-3 w-3" />
        </div>
    );
};

export const TaskListItem = ({ task }: { task: GanttTask }) => (
    <div className="h-10 border-b border-slate-800 px-3 flex items-center justify-between text-sm hover:bg-slate-800/20">
        <span className="truncate">{task.title}</span>
        <TaskStatusBadge status={task.status} />
    </div>
);
