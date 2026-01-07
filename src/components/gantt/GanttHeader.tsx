// components/gantt/GanttHeader.tsx
"use client";

import dayjs from "dayjs";

interface Props {
  start: string;
  end: string;
  dayWidth: number;
}

export function GanttHeader({ start, end, dayWidth }: Props) {
  const days =
    dayjs(end).diff(dayjs(start), "day");

  const cols = Array.from({ length: days });

  return (
    <div className="flex border-b border-slate-700 bg-slate-900 sticky top-0 z-20">
      {cols.map((_, i) => {
        const date = dayjs(start).add(i, "day");
        return (
          <div
            key={i}
            style={{ width: dayWidth }}
            className="text-[10px] text-slate-400 text-center border-l border-slate-800"
          >
            {date.format("DD")}
          </div>
        );
      })}
    </div>
  );
}
