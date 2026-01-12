
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
  units: z.array(IndicatorUnitSchema),
  // New quarterly fields
  lopTarget: z.coerce.number().min(0).optional(),
  annualTarget: z.coerce.number().min(0).optional(),
  q1Target: z.coerce.number().min(0).optional(),
  q1Actual: z.coerce.number().min(0).optional(),
  q2Target: z.coerce.number().min(0).optional(),
  q2Actual: z.coerce.number().min(0).optional(),
  q3Target: z.coerce.number().min(0).optional(),
  q3Actual: z.coerce.number().min(0).optional(),
  q4Target: z.coerce.number().min(0).optional(),
  q4Actual: z.coerce.number().min(0).optional(),
}).refine(data => data.isNew || (
    data.lopTarget !== undefined && data.annualTarget !== undefined &&
    data.q1Target !== undefined && data.q1Actual !== undefined &&
    data.q2Target !== undefined && data.q2Actual !== undefined &&
    data.q3Target !== undefined && data.q3Actual !== undefined &&
    data.q4Target !== undefined && data.q4Actual !== undefined
), {
    message: "All target and actual fields are required.",
    path: ["lopTarget"], // Attach error to a field
});


export const IndicatorTrackingPlanSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  indicators: z.array(IndicatorSchema),
});

export type IndicatorUnit = z.infer<typeof IndicatorUnitSchema>;
export type Indicator = z.infer<typeof IndicatorSchema>;
export type IndicatorTrackingPlan = z.infer<typeof IndicatorTrackingPlanSchema>;

