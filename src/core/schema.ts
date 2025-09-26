// src/core/schema.ts
import { z } from "zod";

export const settingsSchema = z.object({
  loops: z.number().min(1),
  plateIndex: z.number().min(1).default(1),
  holdBedC: z.number().optional(),

  detach: z.object({
    zOffsetMm: z.number().min(0),
    fanOn: z.boolean(),
    homeBetween: z.boolean(),
    safeLift: z.boolean(),

    coolMode: z.enum(["temp", "time"]),
    coolTempC: z.number().min(0),
    coolSeconds: z.number().min(0),

    sweepsSlow: z.number().min(0),
    sweepsFast: z.number().min(0),
    sweepFeedSlow: z.number().min(1),
    sweepFeedFast: z.number().min(1),
    sweepStepX: z.number().min(1),
    sweepYmax: z.number().min(100),

    sweepXmin: z.number().min(0).default(0),
    sweepXmax: z.number().min(50).default(220),

    bendTopZ: z.number().min(0),
    bendBottomZ: z.number().min(0),
    bendCycles: z.number().min(0),
    bendFeed: z.number().min(1),
  }),
});

export type Settings = z.infer<typeof settingsSchema>;
