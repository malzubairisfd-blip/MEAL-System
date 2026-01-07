// components/gantt/GanttHeader.tsx
"use client";

import dayjs from "dayjs";
import { useMemo } from "react";

interface Props {
  start: string;
  end: string;
  dayWidth: number;
}

export function GanttHeader({ start, end, dayWidth }: Props) {
  const { months, totalWidth, days } = useMemo(() => {
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    const days = endDate.diff(startDate, "day") + 1;
    const totalWidth = days * dayWidth;

    const months = [];
    let currentMonth = startDate.clone();
    while (currentMonth.isBefore(endDate) || currentMonth.isSame(endDate, 'month')) {
      const daysInMonth = currentMonth.daysInMonth();
      const firstDayOfMonth = currentMonth.startOf('month');
      const lastDayOfMonth = currentMonth.endOf('month');

      const startOffset = Math.max(0, firstDayOfMonth.diff(startDate, 'day'));
      const endOffset = Math.min(days, lastDayOfMonth.diff(startDate, 'day') + 1);

      const width = (endOffset - startOffset) * dayWidth;

      months.push({
        name: currentMonth.format("MMMM YYYY"),
        width: width,
      });
      currentMonth = currentMonth.add(1, 'month');
    }

    return { months, totalWidth, days };
  }, [start, end, dayWidth]);

  return (
    <div className="sticky top-0 z-20 bg-slate-900 select-none">
      {/* Month Row */}
      <div className="flex border-b border-slate-700">
        {months.map((month, i) => (
          <div
            key={i}
            style={{ width: month.width }}
            className="text-sm font-semibold text-slate-200 text-center py-1 border-r border-slate-800"
          >
            {month.name}
          </div>
        ))}
      </div>
      {/* Day Row */}
      <div className="flex">
        {Array.from({ length: days }).map((_, i) => {
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
    </div>
  );
}
