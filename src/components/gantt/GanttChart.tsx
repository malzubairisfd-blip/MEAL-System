// components/gantt/GanttChart.tsx
"use client";

import { GanttTask } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow, TaskListItem } from "./GanttRow";

interface Props {
  tasks: GanttTask[];
  projectStart: string;
  projectEnd: string;
}

export function GanttChart({
  tasks,
  projectStart,
  projectEnd,
}: Props) {
  const dayWidth = 32;

  return (
    <div className="flex bg-slate-900 text-slate-200 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
      {/* LEFT TASK LIST */}
      <div className="w-80 border-r border-slate-700 flex-shrink-0">
        <div className="h-20 border-b border-slate-700 font-semibold px-3 flex items-center">
          {/* This space is for the top-left controls */}
        </div>
        {tasks.map(task => (
          <TaskListItem key={task.id} task={task} />
        ))}
      </div>

      {/* TIMELINE */}
      <div className="overflow-x-auto flex-1">
        <GanttHeader
          start={projectStart}
          end={projectEnd}
          dayWidth={dayWidth}
        />

        {tasks.map(task => (
          <GanttRow
            key={task.id}
            task={task}
            projectStart={projectStart}
            dayWidth={dayWidth}
          />
        ))}
      </div>
    </div>
  );
}
