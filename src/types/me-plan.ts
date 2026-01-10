// src/types/me-plan.ts
import { z } from 'zod';

export const IndicatorPlanSchema = z.object({
  indicatorId: z.string(), // This will be the indicator's description text
  indicatorDescription: z.string(),
  definition: z.string().min(1, "Definition is required.").max(1000),
  collectionMethods: z.string().min(1, "Data collection methods are required."),
  frequency: z.string().min(1, "Frequency and schedule are required."),
  responsibilities: z.string().min(1, "Responsibilities are required."),
  informationUse: z.string().min(1, "Information use is required."),
});

export const MEPlanSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  indicators: z.array(IndicatorPlanSchema).min(1, "At least one indicator plan is required."),
});

export type IndicatorPlan = z.infer<typeof IndicatorPlanSchema>;
export type MEPlan = z.infer<typeof MEPlanSchema>;
