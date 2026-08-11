import { z } from 'zod'

/**
 * Bentuk koreksi transaksi, dipakai bersama oleh tiga tempat:
 *
 *   1. `POST /api/pos/transactions/[id]/edit` — koreksi langsung dengan PIN
 *   2. `POST /api/pos/transactions/[id]/request-approval` — koreksi yang diajukan
 *   3. penerapan koreksi saat permintaan disetujui
 *
 * Disatukan justru karena (2) dan (3) terpisah waktu: muatan yang disimpan saat pengajuan
 * divalidasi ULANG saat disetujui. Kalau tiap tempat punya salinan schema sendiri, keduanya
 * akan menyimpang, dan yang lolos di pengajuan bisa ditolak saat penerapan — atau lebih buruk,
 * sebaliknya.
 */
export const transactionEditPayloadSchema = z.object({
  items: z
    .array(
      z.object({
        transactionItemId: z.number().int().positive().nullable(),
        productId: z.number().int().positive(),
        uomId: z.number().int().positive(),
        qty: z.number().int().positive('Qty item harus lebih dari 0'),
        unitPrice: z.number().int().nonnegative(),
        discountAmount: z.number().int().nonnegative(),
        priceTier: z.string().min(1),
      }),
    )
    .min(1, 'Transaksi harus tetap memiliki minimal satu item'),
  payments: z
    .array(
      z.object({
        paymentMethodId: z.number().int().positive(),
        amount: z.number().int().nonnegative(),
        referenceNumber: z.string().nullable().optional(),
      }),
    )
    .min(1, 'Pembayaran wajib diisi'),
  customerId: z.number().int().positive().nullable().optional(),
  dueAt: z.string().nullable().optional(),
})

export type TransactionEditPayload = z.infer<typeof transactionEditPayloadSchema>

export const editReasonSchema = z
  .string()
  .min(3, 'Alasan koreksi wajib diisi')
  .max(500, 'Alasan maksimal 500 karakter')
