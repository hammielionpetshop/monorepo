// Aturan murni L4c-1: pembagian kehilangan barang (GAJ-77), minus kas POS bersih per periode (GAJ-20, PRD 06 §3.1),
// dan minus kas catat tangan tanpa nama (GAJ-79). Bilangan bulat pasti (BigInt), tanpa pecahan desimal di tengah.

export type LossHolder = { employeeId: number; name: string; weight: number; days: number };

export type LossShare = LossHolder & { amount: number };

export type LossSplit = {
  shares: LossShare[];
  /** Bagian kantor = nilai − jumlah bagian orang; jumlah tiga angka di bawah selalu sama dengan ini. */
  office: { total: number; percentPart: number; dayRemainder: number; rounding: number };
};

/** Pembulatan ke rupiah terdekat, ,5 ke atas, untuk pecahan num/den yang tidak negatif. */
function roundHalfUp(num: bigint, den: bigint): number {
  return Number((num * BigInt(2) + den) / (den * BigInt(2)));
}

/**
 * GAJ-77: bagian orang = nilai × (100% − persen kantor) × bobot ÷ jumlah bobot × hari ÷ jumlah hari periode,
 * dibulatkan sekali per orang. Jumlah bobot = bobot semua yang ikut, dihitung penuh. Sisanya ditanggung kantor.
 */
export function splitLoss(input: { amount: number; officePercent: number; periodDays: number; holders: LossHolder[] }): LossSplit {
  const amount = BigInt(input.amount);
  const office = BigInt(input.officePercent);
  const holders = input.holders.filter((h) => h.weight > 0 && h.days > 0);
  const totalWeight = BigInt(holders.reduce((sum, h) => sum + h.weight, 0));
  const period = BigInt(input.periodDays);
  const percentPart = roundHalfUp(amount * office, BigInt(100));
  if (!holders.length || totalWeight === BigInt(0) || period === BigInt(0)) {
    return { shares: [], office: { total: input.amount, percentPart, dayRemainder: input.amount - percentPart, rounding: 0 } };
  }
  const den = BigInt(100) * totalWeight * period;
  const shares = holders.map((h) => ({
    ...h, amount: roundHalfUp(amount * (BigInt(100) - office) * BigInt(h.weight) * BigInt(Math.min(h.days, input.periodDays)), den),
  }));
  const people = shares.reduce((sum, s) => sum + s.amount, 0);
  const total = input.amount - people;
  // Sisa sebanding hari = bagian orang tanpa pembulatan bila semua bekerja penuh, dikurangi bagian sebenarnya.
  const fullDays = holders.reduce((sum, h) => sum + BigInt(h.weight) * BigInt(Math.min(h.days, input.periodDays)), BigInt(0));
  const exactPeople = amount * (BigInt(100) - office) * fullDays;
  const dayRemainder = roundHalfUp(amount * (BigInt(100) - office) * totalWeight * period - exactPeople, den);
  return { shares, office: { total, percentPart, dayRemainder, rounding: total - percentPart - dayRemainder } };
}

export type ShortageRow = { amount: number; waived: boolean };

/** Minus kas POS satu orang satu periode: minus disahkan dikurangi plus periode yang sama, paling kecil Rp0. */
export function netShortage(rows: readonly ShortageRow[]): { minus: number; plus: number; net: number } {
  let minus = 0;
  let plus = 0;
  for (const row of rows) {
    if (row.waived) continue;
    if (row.amount < 0) minus += -row.amount;
    else plus += row.amount;
  }
  return { minus, plus, net: Math.max(0, minus - plus) };
}

/** GAJ-79 tanpa nama: dibagi rata ke yang hadir; sisa pembulatan (ke bawah) ditanggung kantor. */
export function splitEvenly(amount: number, employeeIds: readonly number[]): { shares: { employeeId: number; amount: number }[]; office: number } {
  if (!employeeIds.length) return { shares: [], office: amount };
  const each = Math.floor(amount / employeeIds.length);
  return { shares: employeeIds.map((employeeId) => ({ employeeId, amount: each })), office: amount - each * employeeIds.length };
}

/** Jumlah hari kalender dari `from` sampai `to`, keduanya ikut. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000) + 1;
}
