import { z } from 'zod'

/** Alamat foto bukti yang dihasilkan rute unggah (`/uploads/<uuid>.<ext>`). */
export const proofPhotoUrlSchema = z
  .string()
  .max(300, 'Foto bukti tidak valid')
  .regex(/^\/uploads\/[A-Za-z0-9._-]+$/, 'Foto bukti tidak valid')
  .optional()

/** Foto bukti transfer hanya ditawarkan untuk metode non-tunai. */
export function isNonCashMethod(method: { name: string; type?: string | null } | null | undefined): boolean {
  if (!method) return false
  if (method.type) return method.type !== 'CASH'
  return !/tunai|cash/i.test(method.name)
}

export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024

export const UPLOAD_IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
  'image/heif': 'heif',
}
