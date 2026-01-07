// components/gantt/GanttRow.tsx
"use client";

import dayjs from "dayjs";
import { GanttTask, TaskStatus } from "@/types/gantt";
import { STATUS_COLORS } from "@/lib/statusStyles";
import { calculateWorkingDays } from "@/lib/ganttUtils";
import { ChevronDown, Trash2, Edit, Check, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { cn } from "@/lib/utils";

interface RowProps {
  task: GanttTask;
  projectStart: string;
  dayWidth: number;
  isSubTask?: boolean;
}

export function GanttRow({ task, projectStart, dayWidth, isSubTask = false }: RowProps) {
  const offset = dayjs(task.start).diff(dayjs(projectStart), "day") * dayWidth;
  const duration = calculateWorkingDays(task.start, task.end);
  const width = duration * dayWidth;

  return (
    <div className="relative h-10 border-b border-slate-800">
      <div
        className="absolute h-6 top-2 rounded text-xs text-white px-2 flex items-center shadow-md"
        style={{
          left: offset,
          width,
          backgroundColor: STATUS_COLORS[task.status],
          opacity: isSubTask ? 0.75 : 1,
        }}
        title={`${task.title} (${task.start} → ${task.end})`}
      >
        <div 
          className="absolute left-0 top-0 h-full bg-black/20 rounded"
          style={{ width: `${task.progress}%`}}
        />
        <span className="truncate relative z-10">{task.title}</span>
      </div>
    </div>
  );
}

const TaskStatusBadge = ({ status, onUpdateStatus }: { status: TaskStatus, onUpdateStatus: (status: TaskStatus) => void }) => {
    const statusText = (status || 'PLANNED').replace(/_/g, " ");
    const statuses: TaskStatus[] = ["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"];
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div
                    className="flex items-center justify-center gap-1 rounded px-2 py-0.5 text-xs font-semibold cursor-pointer w-full"
                    style={{ backgroundColor: STATUS_COLORS[status] + '33', color: STATUS_COLORS[status] }}
                >
                    <span>{statusText}</span>
                    <ChevronDown className="h-3 w-3" />
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                {statuses.map(s => (
                     <DropdownMenuItem key={s} onSelect={() => onUpdateStatus(s)}>
                        <div className="flex items-center gap-2">
                           <div className="w-3 h-3 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }}/>
                           {s.replace(/_/g, " ")}
                        </div>
                     </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
};


interface ListItemProps {
    task: GanttTask;
    onDelete: (taskId: string) => void;
    onUpdateStatus: (taskId: string, status: TaskStatus) => void;
    onUpdateProgress: (taskId: string, progress: number) => void;
    isSubTask?: boolean;
    isCollapsed?: boolean;
    onToggleCollapse?: (taskId: string) => void;
}

export const TaskListItem = ({ task, onDelete, onUpdateStatus, onUpdateProgress, isSubTask = false, isCollapsed, onToggleCollapse }: ListItemProps) => {
    const workingDays = calculateWorkingDays(task.start, task.end);

    let progressElement;
    if (isSubTask) {
        progressElement = (
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    min="0"
                    max="100"
                    value={task.progress}
                    onChange={(e) => onUpdateProgress(task.id, parseInt(e.target.value))}
                    className="w-16 h-7 text-center bg-slate-700 border-slate-600"
                />
                <span>%</span>
            </div>
        )
    } else {
         const avgProgress = task.hasSubTasks === 'yes' && task.subTasks && task.subTasks.length > 0 
            ? task.subTasks.reduce((sum, st) => sum + st.progress, 0) / task.subTasks.length
            : task.progress;
        progressElement = (
            <div className="flex items-center gap-2 w-full">
                <Progress value={avgProgress} className="h-2 w-full" />
                <span className="text-xs w-8 text-right">{Math.round(avgProgress)}%</span>
            </div>
        )
    }

    return (
        <div className={`h-10 border-b border-slate-800 px-3 flex items-center justify-between text-sm hover:bg-slate-800/20 group ${isSubTask ? 'pl-8 bg-slate-900/50' : ''}`}>
            <div className="flex items-center gap-1 truncate w-48">
                 {task.hasSubTasks === 'yes' && onToggleCollapse && (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleCollapse(task.id)}>
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                )}
                <span className={cn("truncate", { 'ml-7': task.hasSubTasks !== 'yes' })}>{task.title}</span>
            </div>
            <div className="w-24 flex justify-center">{progressElement}</div>
            <div className="w-24 text-center">{workingDays}</div>
            <div className="w-32 flex justify-center">
                 <TaskStatusBadge status={task.status} onUpdateStatus={(newStatus) => onUpdateStatus(task.id, newStatus)} />
            </div>
            
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <Edit className="h-4 w-4"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem disabled>Edit Task</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-500" onClick={() => onDelete(task.id)}>
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete Task
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    );
};
