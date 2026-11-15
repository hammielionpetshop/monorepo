// Titik toko (spec LT1 §3.8, §13.4, LT1b-2b). Aturan murni: label, tautan peta, akurasi GPS, tempel koordinat. Tanpa DB.
import { REASON_MIN, validPoint } from './trip';

export type PointStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'REPLACED';
export type PointKind = 'NEW' | 'CORRECTION';
export type PointSource = 'VISIT' | 'OFFICE';

export const POINT_STATUS_LABELS: Record<PointStatus, string> = {
  PENDING: 'Menunggu', APPROVED: 'Disetujui', REJECTED: 'Ditolak', REPLACED: 'Diganti',
};
export const POINT_STATUS_TONES: Record<PointStatus, 'info' | 'ok' | 'warn' | 'danger'> = {
  PENDING: 'warn', APPROVED: 'ok', REJECTED: 'danger', REPLACED: 'info',
};
export const POINT_KIND_LABELS: Record<PointKind, string> = { NEW: 'Usulan titik baru', CORRECTION: 'Laporan titik salah' };
export const POINT_SOURCE_LABELS: Record<PointSource, string> = { VISIT: 'dari kunjungan', OFFICE: 'ditempel kantor' };

/** Tautan Google Maps ke satu titik (§13.4 butir 4). */
export function mapUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** Akurasi GPS saat pasang titik dari kunjungan (§13.4 butir 1). Mengembalikan pesan salah atau null. */
export function accuracyProblem(accuracy: number | null | undefined, limitM: number): string | null {
  if (accuracy == null || !Number.isFinite(accuracy)) return 'Akurasi lokasi HP tidak terbaca. Nyalakan lokasi (GPS), tunggu sebentar, lalu ulangi.';
  if (accuracy > limitM) return `Akurasi lokasi HP ${Math.round(accuracy)} m, harus ${limitM} m atau kurang. Tunggu sebentar di depan toko lalu ulangi.`;
  return null;
}

/** Alasan Laporkan titik salah (§13.4 butir 3): wajib, 5–300 huruf. */
export function correctionReason(text: string | null | undefined): { ok: true; value: string } | { ok: false; error: string } {
  const value = (text ?? '').replace(/\s+/g, ' ').trim();
  if (value.length < REASON_MIN) return { ok: false, error: `Tulis kenapa titik lama salah, paling sedikit ${REASON_MIN} huruf.` };
  if (value.length > 300) return { ok: false, error: 'Alasan paling panjang 300 huruf.' };
  return { ok: true, value };
}

const NUMBER = '(-?\\d{1,3}(?:\\.\\d+)?)';
const PATTERNS = [
  new RegExp(`!3d${NUMBER}!4d${NUMBER}`), // tautan tempat Google Maps (paling tepat, titik tempatnya)
  new RegExp(`[?&](?:q|query|ll|destination)=${NUMBER}(?:,|%2C)\\s*${NUMBER}`, 'i'),
  new RegExp(`@${NUMBER},${NUMBER}`),
  new RegExp(`^\\s*${NUMBER}\\s*[,;\\s]\\s*${NUMBER}\\s*$`),
];

/**
 * Tempel koordinat kantor (§13.4 butir 8): "lat, lng" atau tautan Google Maps lengkap. Tautan pendek (maps.app.goo.gl)
 * tidak berisi angka sehingga ditolak dengan petunjuk.
 */
export function parseCoordinates(text: string): { ok: true; latitude: number; longitude: number } | { ok: false; error: string } {
  const value = text.trim();
  if (!value) return { ok: false, error: 'Tempel koordinat atau tautan Google Maps.' };
  if (value.length > 2000) return { ok: false, error: 'Teks terlalu panjang.' };
  for (const pattern of PATTERNS) {
    const match = value.match(pattern);
    if (!match) continue;
    const latitude = Number(match[1]);
    const longitude = Number(match[2]);
    if (!validPoint(latitude, longitude)) return { ok: false, error: 'Koordinat tidak masuk akal. Periksa lagi angkanya.' };
    return { ok: true, latitude, longitude };
  }
  if (/goo\.gl|maps\.app/i.test(value)) {
    return { ok: false, error: 'Tautan pendek tidak berisi koordinat. Buka tautannya, tekan lama titik di peta, lalu salin angka koordinatnya (contoh: -7.35050, 108.10860).' };
  }
  return { ok: false, error: 'Koordinat tidak terbaca. Contoh: -7.35050, 108.10860 atau tautan Google Maps.' };
}

/** Di luar titik toko (§13.4 butir 5): hanya tanda. */
export function outsidePoint(distanceM: number | null | undefined, radiusM: number): boolean {
  return distanceM != null && distanceM > radiusM;
}
