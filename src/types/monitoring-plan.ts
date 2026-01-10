// src/types/monitoring-plan.ts
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

const IndicatorFormSchema = z.object({
  description: z.string().min(1, "Indicator description is required."),
  isNew: z.boolean().optional(),
  definition: z.string().min(1, "Definition is required.").max(1000),
  collectionMethods: z.string().min(1, "Data collection methods are required."),
  frequency: z.string().min(1, "Frequency and schedule are required."),
  responsibilities: z.string().min(1, "Responsibilities are required."),
  informationUse: z.string().min(1, "Information use is required."),
   // These are from original logframe and not directly edited here but needed for structure
  type: z.enum(['#', '%']).optional(),
  target: z.number().optional(),
  meansOfVerification: z.array(z.string()).optional(),
});

const ActivityFormSchema = z.object({
  description: z.string(),
  indicators: z.array(IndicatorFormSchema).min(1, "Each activity must have at least one indicator."),
  risksAndAssumptions: z.any().optional(), // Not edited here
});

const OutputFormSchema = z.object({
  description: z.string(),
  activities: z.array(ActivityFormSchema).min(1),
});


export const MEPlanSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  // The 'indicators' field is now replaced by the nested 'outputs' structure
  indicators: z.array(IndicatorPlanSchema).optional(),
  outputs: z.array(OutputFormSchema).optional(),
});

export type IndicatorPlan = z.infer<typeof IndicatorPlanSchema>;
export type MEPlan = z.infer<typeof MEPlanSchema>;
