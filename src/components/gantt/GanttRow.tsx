// components/gantt/GanttRow.tsx
"use client";

import dayjs from "dayjs";
import { GanttTask, TaskStatus, GanttSubTask } from "@/types/gantt";
import { STATUS_COLORS } from "@/lib/statusStyles";
import { calculateWorkingDays } from "@/lib/ganttUtils";
import { ChevronDown, Trash2, Edit, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "../ui/input";
import { Progress } from "../ui/progress";
import { cn } from "@/lib/utils";

interface RowProps {
  task: GanttTask | GanttSubTask;
  projectStart: string;
  dayWidth: number;
  taskNumber: string;
}

export function GanttRow({ task, projectStart, dayWidth, taskNumber }: RowProps) {
  const offset = dayjs(task.start).diff(dayjs(projectStart), "day") * dayWidth;
  const duration = calculateWorkingDays(task.start, task.end);
  const width = duration * dayWidth;

  return (
    <div className="relative py-2 h-full">
      <div
        className="absolute top-1/2 -translate-y-1/2 rounded text-xs text-white px-2 py-1 shadow-md flex items-center justify-center"
        style={{
          left: offset,
          width,
          backgroundColor: STATUS_COLORS[task.status] || STATUS_COLORS["PLANNED"],
          minHeight: 24,
        }}
        title={`${task.title} (${task.start} → ${task.end})`}
      >
        {/* progress overlay */}
        <div
          className="absolute left-0 top-0 h-full bg-black/20 rounded"
          style={{ width: `${task.progress}%` }}
        />
        <span className="relative z-10 font-mono font-bold">
          {taskNumber}
        </span>
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
                    style={{ backgroundColor: (STATUS_COLORS[status] || STATUS_COLORS['PLANNED']) + '33', color: STATUS_COLORS[status] || STATUS_COLORS['PLANNED'] }}
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
    task: GanttTask | GanttSubTask;
    onDelete: (taskId: string) => void;
    onUpdateStatus: (taskId: string, status: TaskStatus) => void;
    onUpdateProgress: (taskId: string, progress: number) => void;
    isCollapsed?: boolean;
    onToggleCollapse?: (taskId: string) => void;
    level: number;
    canCollapse: boolean;
    taskNumber: string;
}

export const TaskListItem = ({ task, onDelete, onUpdateStatus, onUpdateProgress, isCollapsed, onToggleCollapse, level, canCollapse, taskNumber }: ListItemProps) => {
    const workingDays = calculateWorkingDays(task.start, task.end);

    let progressElement;
    if (level > 0) { // Sub-tasks and sub-of-sub-tasks get an input
        progressElement = (
            <div className="flex items-center gap-2">
                <Input
                    type="number"
                    min="0"
                    max="100"
                    value={isNaN(task.progress) ? 0 : task.progress}
                    onChange={(e) => onUpdateProgress(task.id, parseInt(e.target.value))}
                    className="w-16 h-7 text-center bg-slate-700 border-slate-600"
                />
                <span>%</span>
            </div>
        )
    } else { // Main tasks get a progress bar
         const avgProgress = task.progress || 0;
        progressElement = (
            <div className="flex items-center gap-2 w-full">
                <Progress value={avgProgress} className="h-2 w-full" />
                <span className="text-xs w-8 text-right">{Math.round(isNaN(avgProgress) ? 0 : avgProgress)}%</span>
            </div>
        )
    }

    return (
        <div className={cn("h-full px-3 flex items-center justify-between text-sm group py-1", level > 0 && 'bg-slate-900/50')} style={{ paddingLeft: `${0.75 + level * 1.5}rem`}}>
            <div className='w-12 flex-shrink-0 font-mono text-slate-400'>{taskNumber}</div>
            <div className="flex items-center gap-1 flex-1 py-1 min-w-0">
                 {canCollapse && onToggleCollapse ? (
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onToggleCollapse(task.id)}>
                        {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                ) : (
                    <div className="w-6 h-6 flex-shrink-0" /> // Placeholder for alignment
                )}
                <span className="whitespace-normal break-words">{task.title}</span>
            </div>
            <div className="w-32 flex-shrink-0 flex justify-center">{progressElement}</div>
            <div className="w-24 flex-shrink-0 text-center">{workingDays}</div>
            <div className="w-32 flex-shrink-0 flex justify-center">
                 <TaskStatusBadge status={task.status} onUpdateStatus={(newStatus) => onUpdateStatus(task.id, newStatus)} />
            </div>
            
            <div className="w-8 flex-shrink-0">
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
        </div>
    );
};
