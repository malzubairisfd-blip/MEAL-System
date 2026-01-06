import { z } from 'zod';

export const IndicatorSchema = z.object({
  description: z.string().min(1, "Indicator description is required.").max(100),
  type: z.enum(['#', '%']),
  target: z.number().min(0, "Target must be a positive number."),
  meansOfVerification: z.array(z.string()).min(1, "At least one mean of verification is required."),
});

export const RiskAssumptionSchema = z.object({
  risk: z.string().min(1, "Risk description is required.").max(100),
  assumption: z.string().min(1, "Assumption is required.").max(100),
});

export const ActivitySchema = z.object({
  description: z.string().min(100).max(1000),
  indicators: z.array(IndicatorSchema).min(1),
  risksAndAssumptions: z.array(RiskAssumptionSchema).min(1),
});

export const OutputSchema = z.object({
  description: z.string().min(100).max(1000),
  activities: z.array(ActivitySchema).min(1),
});

export const OutcomeSchema = z.object({
  description: z.string().min(100).max(1000),
});

export const GoalSchema = z.object({
  description: z.string().min(100).max(1000),
});

export const LogframeSchema = z.object({
  projectId: z.string().min(1, "A project must be selected."),
  goal: GoalSchema,
  outcome: OutcomeSchema,
  outputs: z.array(OutputSchema).min(1, "At least one output is required."),
});

export type Logframe = z.infer<typeof LogframeSchema>;
