import { z } from 'zod'

export const returItemsSchema = z
  .array(
    z.object({
      transactionItemId: z.number().int().positive(),
      qty: z.string().regex(/^\d+(\.\d+)?$/, 'Kuantitas tidak valid'),
    }),
  )
  .min(1, 'Pilih minimal 1 item untuk diretur')

/**
 * Muatan pengajuan retur (`void_requests.kind = 'RETUR'`). `items` yang diterapkan saat
 * disetujui — divalidasi ULANG terhadap transaksi saat itu, bukan dipercaya. `display` hanya
 * salinan nama/satuan/harga saat diajukan supaya penyetuju bisa membaca isinya.
 */
export const returRequestPayloadSchema = z.object({
  items: returItemsSchema,
  estimatedRefund: z.number().int().nonnegative(),
  display: z
    .array(
      z.object({
        transactionItemId: z.number().int().positive(),
        productName: z.string(),
        uomCode: z.string(),
        qty: z.string(),
        unitPrice: z.number(),
      }),
    )
    .default([]),
})

export type ReturRequestPayload = z.infer<typeof returRequestPayloadSchema>

/** Hanya nota yang berlaku (termasuk yang sudah dikoreksi) — menunggu void / sudah void tidak. */
export function canRequestRetur(status: string): boolean {
  return status === 'COMPLETED'
}
