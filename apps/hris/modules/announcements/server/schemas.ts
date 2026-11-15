import { z } from 'zod';

/** Bentuk sasaran di pintu API kirim/pratinjau (spec F3-2 §3.3). */
export const emergencyTargetSchema = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ all: z.literal(false), branchIds: z.array(z.number().int().positive()).max(200), positionIds: z.array(z.number().int().positive()).max(200) }),
]);

/** Isian konsep perubahan aturan (spec F3-3 §3.5). Batas longgar; batas sebenarnya diperiksa saat terbit. */
export const draftInputSchema = z.object({
  title: z.string().max(500),
  beforeText: z.string().max(5000),
  afterText: z.string().max(5000),
  askWhom: z.string().max(500),
  changeKind: z.enum(['UNFAVORABLE', 'FAVORABLE']),
  affectsMoney: z.boolean(),
  target: emergencyTargetSchema,
  publishesAt: z.string().max(40).nullable(),
  effectiveOn: z.string().max(10).nullable(),
  supersedesAnnouncementId: z.number().int().positive().nullable(),
});
