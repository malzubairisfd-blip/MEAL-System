// lib/ganttTimeline.ts
import dayjs from "dayjs";
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
dayjs.extend(isSameOrBefore);

export function buildDayRange(start: string, end: string) {
  const days: string[] = [];
  let d = dayjs(start);

  while (d.isSameOrBefore(end, "day")) {
    days.push(d.format("YYYY-MM-DD"));
    d = d.add(1, "day");
  }
  return days;
}
