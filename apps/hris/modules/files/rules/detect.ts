/** Jenis berkas yang diterima (spec L2f-1 §9 butir 7): foto saja, paling besar 10 MB. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AllowedMime = (typeof ALLOWED_MIME)[number];

/** Jenis dibaca dari isi berkas (tanda awal), bukan dari nama atau keterangan pengirim. */
export function detectImageMime(bytes: Uint8Array): AllowedMime | null {
  const starts = (sig: number[], offset = 0) => sig.every((b, i) => bytes[offset + i] === b);
  if (bytes.length >= 3 && starts([0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (bytes.length >= 8 && starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (bytes.length >= 12 && starts([0x52, 0x49, 0x46, 0x46]) && starts([0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isFileId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}
