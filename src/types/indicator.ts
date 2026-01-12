export type IndicatorLevel =
  | "goal"
  | "outcome"
  | "output"
  | "activity";

export type IndicatorFrequency =
  | "monthly"
  | "quarterly"
  | "annual";

export type IndicatorCalculation =
  | "cumulative"   // SUM
  | "latest"       // LAST VALUE
  | "average";     // AVERAGE

export interface Indicator {
  id: string;
  code: string;
  title: string;
  level: IndicatorLevel;
  unit: string;

  calculation: IndicatorCalculation;

  baselineValue: number;
  baselineDate: string;

  targetValue: number;
  targetDate: string;

  frequency: IndicatorFrequency;
  dataSource: string;
  collectionMethod: string;
  responsible: string;
}

export interface IndicatorValue {
  id: string;
  indicatorId: string;

  period: string; // e.g. 2024-Q1
  actualValue: number;

  status: "pending" | "approved" | "rejected";
  comments?: string;

  createdAt: string;
}
