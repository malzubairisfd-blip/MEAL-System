// components/gantt/GanttChart.tsx
"use client";

import React from 'react';
import dayjs from "dayjs";
import minMax from "dayjs/plugin/minMax";
import { GanttTask, TaskStatus } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow, TaskListItem } from "./GanttRow";

dayjs.extend(minMax);

interface Props {
  tasks: GanttTask[];
  projectStart: string;
  projectEnd: string;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
}

export function GanttChart({
  tasks,
  projectStart,
  projectEnd,
  onDeleteTask,
  onUpdateTaskStatus,
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
            <React.Fragment key={task.id}>
              <TaskListItem 
                task={task} 
                onDelete={onDeleteTask}
                onUpdateStatus={onUpdateTaskStatus}
              />
              {task.hasSubTasks === 'yes' && task.subTasks?.map(subTask => (
                   <TaskListItem 
                        key={subTask.id} 
                        task={subTask}
                        onDelete={onDeleteTask} // This might need to be adjusted to delete sub-tasks
                        onUpdateStatus={(status) => onUpdateTaskStatus(subTask.id, status)}
                        isSubTask={true}
                    />
              ))}
            </React.Fragment>
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
          <React.Fragment key={task.id}>
             <GanttRow
                task={task}
                projectStart={projectStart}
                dayWidth={dayWidth}
             />
             {task.hasSubTasks === 'yes' && task.subTasks?.map(subTask => (
                <GanttRow
                    key={subTask.id}
                    task={subTask}
                    projectStart={projectStart}
                    dayWidth={dayWidth}
                    isSubTask={true}
                />
             ))}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
