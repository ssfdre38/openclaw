/**
 * Zod schema for complexity routing configuration.
 */

import { z } from "zod";

export const TaskComplexitySchema = z.enum(["simple", "moderate", "complex"]);

export const ComplexityRoutingStrategySchema = z.enum([
  "cost-optimized",
  "quality-first",
  "quota-aware",
]);

export const CostControlSchema = z
  .object({
    enabled: z.boolean(),
    maxCostPerSession: z.number().nonnegative().optional(),
    maxCostPerRequest: z.number().nonnegative().optional(),
    fallbackToFree: z.boolean().optional(),
  })
  .strict();

export const ClassificationThresholdsSchema = z
  .object({
    simple: z.number().int().nonnegative().optional(),
    moderate: z.number().int().nonnegative().optional(),
  })
  .strict();

export const ComplexityRoutingConfigSchema = z
  .object({
    enabled: z.boolean(),
    strategy: ComplexityRoutingStrategySchema.optional(),
    models: z
      .object({
        simple: z.union([z.string(), z.object({ primary: z.string(), fallbacks: z.array(z.string()).optional() }).strict()]).optional(),
        moderate: z.union([z.string(), z.object({ primary: z.string(), fallbacks: z.array(z.string()).optional() }).strict()]).optional(),
        complex: z.union([z.string(), z.object({ primary: z.string(), fallbacks: z.array(z.string()).optional() }).strict()]).optional(),
      })
      .strict()
      .optional(),
    thresholds: ClassificationThresholdsSchema.optional(),
    costControl: CostControlSchema.optional(),
    forceComplexity: TaskComplexitySchema.optional(),
  })
  .strict();
