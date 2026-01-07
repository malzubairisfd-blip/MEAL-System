// components/gantt/GanttRow.tsx
"use client";

import dayjs from "dayjs";
import { GanttTask, TaskStatus } from "@/types/gantt";
import { STATUS_COLORS } from "@/lib/statusStyles";
import { ChevronDown, Trash2, Edit } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

interface RowProps {
  task: GanttTask;
  projectStart: string;
  dayWidth: number;
}

export function GanttRow({ task, projectStart, dayWidth }: RowProps) {
  const offset = dayjs(task.start).diff(dayjs(projectStart), "day") * dayWidth;
  const duration = dayjs(task.end).diff(dayjs(task.start), "day") + 1;
  const width = duration * dayWidth;

  const statusText = task.status.replace(/_/g, " ");

  return (
    <div className="relative h-10 border-b border-slate-800">
      <div
        className="absolute h-6 top-2 rounded text-xs text-white px-2 flex items-center shadow-md"
        style={{
          left: offset,
          width,
          backgroundColor: STATUS_COLORS[task.status],
        }}
        title={`${task.title} (${task.start} → ${task.end})`}
      >
        <span className="truncate">{task.title}</span>
      </div>
    </div>
  );
}

const TaskStatusBadge = ({ status, onUpdateStatus }: { status: TaskStatus, onUpdateStatus: (status: TaskStatus) => void }) => {
    const statusText = status.replace(/_/g, " ");
    const statuses: TaskStatus[] = ["DONE", "IN_PROGRESS", "PLANNED", "BLOCKED", "EXPECTS_PLANNING"];
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div
                    className="flex items-center justify-center gap-1 rounded px-2 py-0.5 text-xs font-semibold cursor-pointer"
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
}

export const TaskListItem = ({ task, onDelete, onUpdateStatus }: ListItemProps) => (
    <div className="h-10 border-b border-slate-800 px-3 flex items-center justify-between text-sm hover:bg-slate-800/20 group">
        <span className="truncate">{task.title}</span>
        <div className="flex items-center gap-2">
            <TaskStatusBadge status={task.status} onUpdateStatus={(newStatus) => onUpdateStatus(task.id, newStatus)} />
             <DropdownMenu>
                <DropdownMenuTrigger asChild>
                   <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100">
                        <Edit className="h-4 w-4"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuItem>Edit Task</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-red-500" onClick={() => onDelete(task.id)}>
                        <Trash2 className="mr-2 h-4 w-4"/>
                        Delete Task
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
    </div>
);
