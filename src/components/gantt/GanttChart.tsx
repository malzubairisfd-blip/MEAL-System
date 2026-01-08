// components/gantt/GanttChart.tsx
"use client";

import React, { useMemo, useState, useCallback, useRef } from 'react';
import dayjs from "dayjs";
import { GanttTask, TaskStatus, GanttSubTask } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow, TaskListItem } from "./GanttRow";
import { calculateWorkingDays } from '@/lib/ganttUtils';
import { Activity, Sigma } from 'lucide-react';


const GanttTaskRow = ({
  task,
  level = 0,
  taskNumber,
  ...props
}: {
  task: GanttTask | GanttSubTask;
  level?: number;
  taskNumber: string;
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
              taskNumber={taskNumber}
            />
          </div>
          <div className="flex-1 relative">
            <GanttRow
              task={task}
              projectStart={props.projectStart}
              dayWidth={props.dayWidth}
              taskNumber={taskNumber}
            />
          </div>
        </div>
      {!isCollapsed && canCollapse && (
        <>
          {hasSubTasks && 'subTasks' in task && task.subTasks?.map((subTask, subIndex) => (
            <GanttTaskRow key={subTask.id} task={subTask} level={level + 1} taskNumber={`${taskNumber}.${subIndex + 1}`} {...props} />
          ))}
          {hasSubOfSubTasks && 'subOfSubTasks' in task && task.subOfSubTasks?.map((subOfSubTask, sssIndex) => (
             <GanttTaskRow key={subOfSubTask.id} task={subOfSubTask} level={level + 2} taskNumber={`${taskNumber}.${sssIndex + 1}`} {...props} />
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
        let totalWeightedProgress = 0;
        let totalDuration = 0;
        
        tasks.forEach(task => {
            const taskWorkingDays = calculateWorkingDays(task.start, task.end);
            if (taskWorkingDays > 0) {
                totalWeightedProgress += (task.progress || 0) * taskWorkingDays;
                totalDuration += taskWorkingDays;
            }
        });

        const overallProgress = totalDuration > 0 ? totalWeightedProgress / totalDuration : 0;
        
        return { overallProgress, totalWorkingDays: totalDuration };
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
                <div className="h-20 border-b border-slate-700 font-semibold px-3 flex items-center">
                    <div className='w-12'>#</div>
                    <div className='flex-1'>Task & Progress</div>
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
             {tasks.map((task, index) => (
                <GanttTaskRow
                  key={task.id}
                  task={task}
                  level={0}
                  taskNumber={`${index + 1}`}
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
