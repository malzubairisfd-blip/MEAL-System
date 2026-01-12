
// src/types/monitoring-indicators.ts
import { z } from 'zod';

export const IndicatorUnitSchema = z.object({
  unit: z.string().min(1, "Unit description is required."),
  targeted: z.coerce.number().min(0, "Targeted value must be a positive number."),
  actual: z.coerce.number().min(0, "Actual value must be a positive number."),
  dataSource: z.string().min(1, "Data source is required."),
  responsibilities: z.string().min(1, "Responsibilities are required."),
});

export const IndicatorSchema = z.object({
  indicatorId: z.string().min(1, "New indicator title is required."),
  indicatorCode: z.string().optional(),
  type: z.enum(['#', '%']).optional(),
  isNew: z.boolean().optional(),
  outcome: z.string().optional(),
  output: z.string().optional(),
  activity: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  units: z.array(IndicatorUnitSchema).min(1, "At least one unit must be defined for each indicator."),
});

export const IndicatorTrackingPlanSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  indicators: z.array(IndicatorSchema),
});

export type IndicatorUnit = z.infer<typeof IndicatorUnitSchema>;
export type Indicator = z.infer<typeof IndicatorSchema>;
export type IndicatorTrackingPlan = z.infer<typeof IndicatorTrackingPlanSchema>;
