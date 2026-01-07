// components/gantt/GanttChart.tsx
"use client";

import React, { useMemo } from 'react';
import dayjs from "dayjs";
import { GanttTask, TaskStatus } from "@/types/gantt";
import { GanttHeader } from "./GanttHeader";
import { GanttRow, TaskListItem } from "./GanttRow";
import { calculateWorkingDays } from '@/lib/ganttUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';

interface Props {
  tasks: GanttTask[];
  projectStart: string;
  projectEnd: string;
  onDeleteTask: (taskId: string) => void;
  onUpdateTaskStatus: (taskId: string, status: TaskStatus) => void;
  onUpdateTaskProgress: (taskId: string, progress: number) => void;
}

const KPICard = ({ title, value, footer }: { title: string, value: React.ReactNode, footer?: string }) => (
    <Card className="bg-slate-800 border-slate-700 text-white">
        <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
            {footer && <p className="text-xs text-muted-foreground">{footer}</p>}
        </CardContent>
    </Card>
);

export function GanttChart({
  tasks,
  projectStart,
  projectEnd,
  onDeleteTask,
  onUpdateTaskStatus,
  onUpdateTaskProgress
}: Props) {
  const dayWidth = 32;

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
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <KPICard 
            title="Overall Progress"
            value={
                <div className="flex items-center gap-2">
                    <Progress value={overallProgress} className="h-1"/>
                    <span className="text-lg">{Math.round(overallProgress)}%</span>
                </div>
            }
        />
        <KPICard title="Total Working Days" value={totalWorkingDays.toLocaleString()} />
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
        {tasks.map(task => (
            <React.Fragment key={task.id}>
              <TaskListItem 
                task={task} 
                onDelete={onDeleteTask}
                onUpdateStatus={onUpdateTaskStatus}
                onUpdateProgress={onUpdateTaskProgress}
              />
              {task.hasSubTasks === 'yes' && task.subTasks?.map(subTask => (
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
    </>
  );
}
