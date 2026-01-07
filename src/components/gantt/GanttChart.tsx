// components/gantt/GanttChart.tsx
"use client";

import { GanttTask } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow } from "./GanttRow";

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
    <div className="flex bg-slate-950 text-slate-200 rounded-lg overflow-hidden">
      {/* LEFT TASK LIST */}
      <div className="w-80 border-r border-slate-800">
        <div className="h-10 border-b border-slate-700 font-semibold px-3 flex items-center">
          Tasks
        </div>

        {tasks.map(task => (
          <div
            key={task.id}
            className="h-10 border-b border-slate-800 px-3 flex items-center text-sm"
          >
            {task.title}
          </div>
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
