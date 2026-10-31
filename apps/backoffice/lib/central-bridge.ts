/**
 * Jembatan token lama pada mode `central` (keputusan owner 2026-11-01, spec L1 §8).
 *
 * Berkas murni tanpa impor berat agar mudah diuji. Jembatan hanya hidup bila
 * `BO_AUTH_BRIDGE_UNTIL` berisi waktu ISO di masa depan dan paling jauh 7 hari dari sekarang.
 * Nilai yang tidak valid, sudah lewat, atau terlalu jauh MENUTUP jembatan (gagal tertutup),
 * sehingga salah ketik tidak membuka jembatan tanpa batas.
 */
export const BRIDGE_MAX_MS = 7 * 24 * 60 * 60 * 1000;

export function getBridgeDeadline(now: Date = new Date(), raw: string | undefined = process.env.BO_AUTH_BRIDGE_UNTIL): Date | null {
  const value = raw?.trim();
  if (!value) return null;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return null;
  if (deadline.getTime() <= now.getTime()) return null;
  if (deadline.getTime() - now.getTime() > BRIDGE_MAX_MS) return null;
  return deadline;
}
