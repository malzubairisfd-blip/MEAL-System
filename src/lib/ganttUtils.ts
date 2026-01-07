// lib/ganttUtils.ts
import dayjs from "dayjs";

export function daysBetween(a: string, b: string) {
  return dayjs(b).diff(dayjs(a), "day");
}

export function clamp(val: number, min: number, max: number) {
  return Math.min(Math.max(val, min), max);
}
