// components/gantt/GanttRow.tsx
"use client";

import dayjs from "dayjs";
import { GanttTask } from "@/types/gantt";
import { STATUS_COLORS } from "@/lib/statusStyles";

interface Props {
  task: GanttTask;
  projectStart: string;
  dayWidth: number;
}

export function GanttRow({ task, projectStart, dayWidth }: Props) {
  const offset =
    dayjs(task.start).diff(dayjs(projectStart), "day") * dayWidth;

  const width =
    dayjs(task.end).diff(dayjs(task.start), "day") * dayWidth;

  return (
    <div className="relative h-10 border-b border-slate-800">
      <div
        className="absolute h-6 top-2 rounded-md text-xs text-white px-2 flex items-center shadow"
        style={{
          left: offset,
          width,
          backgroundColor: STATUS_COLORS[task.status],
        }}
        title={`${task.start} → ${task.end}`}
      >
        {task.title}
      </div>
    </div>
  );
}
