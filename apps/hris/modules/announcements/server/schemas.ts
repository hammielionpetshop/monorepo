import { z } from 'zod';

/** Bentuk sasaran di pintu API kirim/pratinjau (spec F3-2 §3.3). */
export const emergencyTargetSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ all: z.literal(false), branchIds: z.array(z.number().int().positive()).max(200), positionIds: z.array(z.number().int().positive()).max(200) }),
]);
