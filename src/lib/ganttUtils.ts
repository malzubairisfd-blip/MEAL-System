// lib/ganttUtils.ts
import dayjs from "dayjs";

export function daysBetween(a: string, b: string) {
  if (!a || !b) return 0;
  return dayjs(b).diff(dayjs(a), "day");
}

export function calculateWorkingDays(start: string, end: string) {
    if (!start || !end) return 0;
    const startDate = dayjs(start);
    const endDate = dayjs(end);

    if (endDate.isBefore(startDate)) return 0;
    
    let count = 0;
    let current = startDate;

    while(current.isBefore(endDate) || current.isSame(endDate, 'day')) {
        // Assuming a 6-day work week (Friday is off in Yemen)
        if (current.day() !== 5) {
            count++;
        }
        current = current.add(1, 'day');
    }
    return count;
}


export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}
