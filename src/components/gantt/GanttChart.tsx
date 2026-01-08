// components/gantt/GanttChart.tsx
"use client";

import React, { useMemo, useState, useCallback } from 'react';
import dayjs from "dayjs";
import { GanttTask, TaskStatus, GanttSubTask } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow, TaskListItem } from "./GanttRow";
import { calculateWorkingDays } from '@/lib/ganttUtils';
import { Activity, Sigma } from 'lucide-react';


const GanttTaskRow = ({
  task,
  level = 0,
  ...props
}: {
  task: GanttTask | GanttSubTask;
  level?: number;
  projectStart: string;
  dayWidth: number;
  collapsedTasks: Set<string>;
  onToggleCollapse: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onUpdateTaskProgress: (taskId: string, progress: number) => void;
}) => {
  const isCollapsed = props.collapsedTasks.has(task.id);
  const hasSubTasks = 'hasSubTasks' in task ? task.hasSubTasks === 'yes' && task.subTasks && task.subTasks.length > 0 : false;
  const hasSubOfSubTasks = 'hasSubOfSubTasks' in task ? task.hasSubOfSubTasks === 'yes' && task.subOfSubTasks && task.subOfSubTasks.length > 0 : false;
  
  const canCollapse = hasSubTasks || hasSubOfSubTasks;

  return (
    <React.Fragment>
      <div className="flex border-b border-slate-800">
        <div className="w-[600px] flex-shrink-0">
          <TaskListItem
            task={task}
            isCollapsed={isCollapsed}
            onToggleCollapse={props.onToggleCollapse}
            onDelete={props.onDeleteTask}
            onUpdateStatus={props.onUpdateTaskStatus}
            onUpdateProgress={props.onUpdateTaskProgress}
            level={level}
            canCollapse={canCollapse}
          />
        </div>
        <div className="flex-1 relative">
          <GanttRow
            task={task}
            projectStart={props.projectStart}
            dayWidth={props.dayWidth}
          />
        </div>
      </div>
      {!isCollapsed && canCollapse && (
        <>
          {hasSubTasks && 'subTasks' in task && task.subTasks?.map(subTask => (
            <GanttTaskRow key={subTask.id} task={subTask} level={level + 1} {...props} />
          ))}
          {hasSubOfSubTasks && 'subOfSubTasks' in task && task.subOfSubTasks?.map(subOfSubTask => (
             <GanttTaskRow key={subOfSubTask.id} task={subOfSubTask} level={level + 2} {...props} />
          ))}
        </>
      )}
    </React.Fragment>
  );
};


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
                const subTaskProgressAvg = task.subTasks!.reduce((acc, st) => acc + (st.progress || 0), 0) / (task.subTasks!.length || 1);
                return sum + subTaskProgressAvg;
            }, 0);
            overallProgress = totalProgress / (mainTasksWithSubtasks.length || 1);
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
                <div className="text-xl font-bold">{Math.round(isNaN(overallProgress) ? 0 : overallProgress)}%</div>
            </div>
        </div>
        <div className="flex items-center gap-3">
            <Sigma className="h-6 w-6 text-green-400" />
             <div>
                <div className="text-sm text-slate-300">Total Working Days</div>
                <div className="text-xl font-bold">{totalWorkingDays.toLocaleString()}</div>
            </div>
        </div>
    </div>

    <div className="bg-slate-900 text-slate-200 rounded-lg overflow-hidden border border-slate-700 shadow-xl">
        <div className="flex sticky top-0 z-20 bg-slate-900">
            {/* LEFT HEADER */}
             <div className="w-[600px] border-r border-slate-700 flex-shrink-0">
                <div className="h-20 border-b border-slate-700 font-semibold px-3 flex items-center justify-between">
                    <div className='flex-1'>Task</div>
                    <div className='w-32 text-center'>Progress</div>
                    <div className='w-24 text-center'>Working Days</div>
                    <div className='w-32 text-center'>Status</div>
                    <div className='w-8'></div>
                </div>
            </div>
            {/* RIGHT HEADER */}
            <div className="overflow-x-auto flex-1">
                <GanttHeader
                start={projectStart}
                end={projectEnd}
                dayWidth={dayWidth}
                />
            </div>
        </div>
        
        <div className='relative'>
             {tasks.map(task => (
                <GanttTaskRow
                  key={task.id}
                  task={task}
                  level={0}
                  projectStart={projectStart}
                  dayWidth={dayWidth}
                  collapsedTasks={collapsedTasks}
                  onToggleCollapse={toggleCollapse}
                  onDeleteTask={onDeleteTask}
                  onUpdateTaskStatus={onUpdateTaskStatus}
                  onUpdateTaskProgress={onUpdateTaskProgress}
                />
            ))}
        </div>

    </div>
    </>
  );
}
