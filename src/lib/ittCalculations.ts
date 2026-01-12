import { Indicator, IndicatorValue } from "@/types/indicator";

/**
 * Calculate Life-of-Project (LoP) Actual
 * based on indicator calculation type
 */
export function calculateLoPActual(
  indicator: Indicator,
  values: IndicatorValue[]
): number | null {
  const approved = values.filter(v => v.status === "approved");

  if (approved.length === 0) return null;

  switch (indicator.calculation) {
    case "cumulative":
      return approved.reduce((sum, v) => sum + (v.actualValue || 0), 0);

    case "average":
      return (
        approved.reduce((sum, v) => sum + (v.actualValue || 0), 0) /
        approved.length
      );

    case "latest":
      return approved
        .sort((a, b) => b.period.localeCompare(a.period))[0]
        .actualValue;

    default:
      return null;
  }
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(
  lopActual: number | null,
  target: number
): number {
  if (lopActual === null || target <= 0) return 0;
  return Math.min(100, (lopActual / target) * 100);
}

/**
 * Indicator status based on LoP progress
 */
export function getIndicatorStatus(
  lopActual: number | null,
  target: number
): "no data" | "off track" | "on track" | "achieved" {
  if (lopActual === null) return "no data";
  if (lopActual >= target) return "achieved";
  if (lopActual >= target * 0.5) return "on track";
  return "off track";
}
