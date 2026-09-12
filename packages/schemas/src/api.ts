/** Request/response schemas for the public API — shared by web, mobile and the AI worker. */
import { z } from "zod";

export const localeSettingsSchema = z.object({
  countryCode: z.string().regex(/^[A-Za-z]{2}$/),
  language: z.string().min(2).max(20),
  timezone: z.string().min(3).max(60),
  weekStart: z.union([z.literal(0), z.literal(1)]),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  displayName: z.string().min(1).max(80).optional(),
  currency: z.string().length(3).default("USD"),
  locale: localeSettingsSchema.optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const transactionCreateSchema = z.object({
  /** Positive number in major units, e.g. 950.5. Stored as integer minor units. */
  amount: z.number().positive().max(1e12),
  currency: z.string().length(3).optional(), // defaults to profile currency
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  merchant: z.string().min(1).max(120),
  categoryId: z.string().optional(),
  source: z.enum(["manual", "text", "voice", "import", "receipt"]).default("manual"),
  notes: z.string().max(500).optional(),
});

export const transactionParseSchema = z.object({
  text: z.string().min(1).max(300),
});

export const goalCreateSchema = z.object({
  name: z.string().min(1).max(80),
  targetAmount: z.number().positive().max(1e12),
  targetDate: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).optional(),
  priority: z.number().int().min(1).max(9).default(3),
  minMonthlyContribution: z.number().nonnegative().optional(),
});

export const profileUpdateSchema = z.object({
  currency: z.string().length(3).optional(),
  locale: localeSettingsSchema.optional(),
  preferences: z
    .object({
      savingsStyle: z.enum(["conservative", "balanced", "ambitious"]).optional(),
      buffer: z
        .object({
          kind: z.enum(["fixed", "percent_of_income"]),
          value: z.number().nonnegative(),
        })
        .optional(),
      bufferBeforeGoals: z.boolean().optional(),
      values: z.array(z.string().max(40)).max(20).optional(),
    })
    .optional(),
  incomeSources: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(80),
        expectedAmount: z.number().positive().max(1e12),
        frequency: z.enum(["monthly", "biweekly", "weekly"]),
        paydayDay: z.number().int().min(1).max(28).optional(),
        reliability: z.enum(["stable", "variable"]),
      }),
    )
    .optional(),
  commitments: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(80),
        expectedAmount: z.number().nonnegative().max(1e12),
        essential: z.boolean(),
        cadence: z.enum(["monthly", "weekly", "annual"]),
        dueDay: z.number().int().min(1).max(31).optional(),
        rangeLow: z.number().nonnegative().optional(),
        rangeHigh: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
  categories: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1).max(60),
        baselineWeight: z.number().positive().max(100),
        floor: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
  emergency: z
    .object({
      currentAmount: z.number().nonnegative().max(1e12),
      targetAmount: z.number().nonnegative().max(1e12),
    })
    .optional(),
});

export const aiMessageSchema = z.object({
  text: z.string().min(1).max(2000),
});

export const csvImportSchema = z.object({
  csv: z.string().min(1).max(2_000_000),
});

export const rolloverSchema = z.object({
  period: z
    .object({
      year: z.number().int().min(2000).max(2100),
      month: z.number().int().min(1).max(12),
    })
    .optional(),
});
