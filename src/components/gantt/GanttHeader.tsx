// components/gantt/GanttHeader.tsx
"use client";

import dayjs from "dayjs";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import isoWeek from 'dayjs/plugin/isoWeek';

dayjs.extend(isoWeek);

interface Props {
  start: string;
  end: string;
  dayWidth: number;
}

export function GanttHeader({ start, end, dayWidth }: Props) {
  const { months, totalWidth, days, weeks } = useMemo(() => {
    const startDate = dayjs(start);
    const endDate = dayjs(end);
    const totalDays = endDate.diff(startDate, "day") + 1;
    const totalWidth = totalDays * dayWidth;

    const months = [];
    let currentMonth = startDate.clone();
    while (currentMonth.isBefore(endDate) || currentMonth.isSame(endDate, 'month')) {
      const firstDayOfMonth = currentMonth.startOf('month');
      const lastDayOfMonth = currentMonth.endOf('month');

      const startOffset = Math.max(0, firstDayOfMonth.diff(startDate, 'day'));
      const endOffset = Math.min(totalDays, lastDayOfMonth.diff(startDate, 'day') + 1);

      const width = (endOffset - startOffset) * dayWidth;
      
      if (width > 0) {
        months.push({
          name: currentMonth.format("MMMM YYYY"),
          width: width,
        });
      }
      currentMonth = currentMonth.add(1, 'month');
    }

    const weeks = [];
    let currentDay = startDate.clone();
    let weekNumber = 1;
    while(currentDay.isBefore(endDate) || currentDay.isSame(endDate, 'day')) {
        const remainingDaysInView = endDate.diff(currentDay, 'day') + 1;
        const daysInThisWeek = Math.min(7, remainingDaysInView);

        weeks.push({
            name: `Week ${weekNumber}`,
            width: daysInThisWeek * dayWidth,
        });
        currentDay = currentDay.add(7, 'day');
        weekNumber++;
    }


    return { months, totalWidth, days: totalDays, weeks };
  }, [start, end, dayWidth]);

  return (
    <div className="sticky top-0 z-20 bg-slate-900 select-none">
      {/* Week Row */}
      <div className="flex border-b border-slate-700">
        {weeks.map((week, i) => (
          <div
            key={i}
            style={{ width: week.width }}
            className="text-xs font-semibold text-slate-300 text-center py-1 border-r border-slate-800"
          >
            {week.name}
          </div>
        ))}
      </div>

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
          const dayOfWeek = date.day(); // 0 (Sun) to 6 (Sat)
          const isWeekend = dayOfWeek === 5 || dayOfWeek === 6; // Friday or Saturday

          return (
            <div
              key={i}
              style={{ width: dayWidth }}
              className={cn(
                "text-[10px] text-slate-400 text-center border-l border-slate-800",
                 isWeekend && "bg-slate-800/50"
              )}
            >
              {date.format("DD")}
            </div>
          );
        })}
      </div>
    </div>
  );
}
