// components/gantt/GanttChart.tsx
"use client";

import React, { useMemo, useState, useCallback } from 'react';
import dayjs from "dayjs";
import { GanttTask, TaskStatus } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow, TaskListItem } from "./GanttRow";
import { calculateWorkingDays } from '@/lib/ganttUtils';
import { Activity, Sigma } from 'lucide-react';


export function GanttChart({
  tasks,
  projectStart,
  projectEnd,
  onDeleteTask,
  onUpdateTaskStatus,
  onUpdateTaskProgress
}: {
  tasks: GanttTask[];
  projectStart: string;
  projectEnd: string;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onUpdateTaskProgress: (taskId: string, progress: number) => void;
}) {
  const dayWidth = 32;
  const [collapsedTasks, setCollapsedTasks] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((taskId: string) => {
    setCollapsedTasks(prev => {
        const newSet = new Set(prev);
        if (newSet.has(taskId)) {
            newSet.delete(taskId);
        } else {
            newSet.add(taskId);
        }
        return newSet;
    });
  }, []);

    const { overallProgress, totalWorkingDays } = useMemo(() => {
        const mainTasksWithSubtasks = tasks.filter(t => t.hasSubTasks === 'yes' && t.subTasks && t.subTasks.length > 0);
        
        let overallProgress = 0;
        if (mainTasksWithSubtasks.length > 0) {
            const totalProgress = mainTasksWithSubtasks.reduce((sum, task) => {
                const subTaskProgressAvg = task.subTasks!.reduce((acc, st) => acc + st.progress, 0) / task.subTasks!.length;
                return sum + subTaskProgressAvg;
            }, 0);
            overallProgress = totalProgress / mainTasksWithSubtasks.length;
        }

        const totalWorkingDays = tasks.reduce((sum, task) => {
            if (task.hasSubTasks === 'yes' && task.subTasks) {
                return sum + task.subTasks.reduce((subSum, st) => subSum + calculateWorkingDays(st.start, st.end), 0);
            }
            return sum + calculateWorkingDays(task.start, task.end);
        }, 0);

        return { overallProgress, totalWorkingDays };
    }, [tasks]);

  return (
    <>
    <div className="flex items-center gap-6 mb-4 bg-slate-800 border border-slate-700 rounded-lg p-4 text-white">
        <div className="flex items-center gap-3">
            <Activity className="h-6 w-6 text-blue-400" />
            <div>
                <div className="text-sm text-slate-300">Overall Progress</div>
                <div className="text-2xl font-bold">{Math.round(overallProgress)}%</div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <Sigma className="h-6 w-6 text-green-400" />
             <div>
                <div className="text-sm text-slate-300">Total Working Days</div>
                <div className="text-2xl font-bold">{totalWorkingDays.toLocaleString()}</div>
            </div>
        </div>
    </div>

    <div className="flex bg-slate-900 text-slate-200 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
      {/* LEFT TASK LIST */}
      <div className="w-[500px] border-r border-slate-700 flex-shrink-0">
        <div className="h-20 border-b border-slate-700 font-semibold px-3 flex items-center justify-between">
          <div className='w-48'>Task</div>
          <div className='w-24 text-center'>Progress</div>
          <div className='w-24 text-center'>Working Days</div>
          <div className='w-32 text-center'>Status</div>
        </div>
        {tasks.map(task => {
            const isCollapsed = collapsedTasks.has(task.id);
            return (
                <React.Fragment key={task.id}>
                <TaskListItem 
                    task={task} 
                    onDelete={onDeleteTask}
                    onUpdateStatus={onUpdateTaskStatus}
                    onUpdateProgress={onUpdateTaskProgress}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={toggleCollapse}
                />
                {!isCollapsed && task.hasSubTasks === 'yes' && task.subTasks?.map(subTask => (
                    <TaskListItem 
                            key={subTask.id} 
                            task={subTask}
                            onDelete={onDeleteTask}
                            onUpdateStatus={onUpdateTaskStatus}
                            onUpdateProgress={onUpdateTaskProgress}
                            isSubTask={true}
                        />
                ))}
                </React.Fragment>
            )
        })}
      </div>

      {/* TIMELINE */}
      <div className="overflow-x-auto flex-1">
        <GanttHeader
          start={projectStart}
          end={projectEnd}
          dayWidth={dayWidth}
        />

        {tasks.map(task => {
          const isCollapsed = collapsedTasks.has(task.id);
          return (
            <React.Fragment key={task.id}>
             <GanttRow
                task={task}
                projectStart={projectStart}
                dayWidth={dayWidth}
             />
             {!isCollapsed && task.hasSubTasks === 'yes' && task.subTasks?.map(subTask => (
                <GanttRow
                    key={subTask.id}
                    task={subTask}
                    projectStart={projectStart}
                    dayWidth={dayWidth}
                    isSubTask={true}
                />
             ))}
            </React.Fragment>
          )
        })}
      </div>
    </div>
    </>
  );
}
