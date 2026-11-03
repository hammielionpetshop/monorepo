import { longDate, periodEndOf, rupiah, type IsoDate } from './salary';

// Pendapatan Saya dan Slip Saya (spec L4g-1 §3.1–3.3): aturan murni tanpa DB.

export type PayIssue = { who: 'YOU' | 'OFFICE'; text: string; link: string | null };

export type PayIssueFacts = {
  /** Hari yang kejadian Perlu Dijelaskannya belum diisi orang itu sendiri. */
  unexplained: IsoDate[];
  outsideReviews: IsoDate[];
  clarifications: IsoDate[];
  overtimeClaims: IsoDate[];
  noSalary: boolean;
  /** Slip terakhir menunggu bonus Menunggu/Ditahan diputus (penahan 5). */
  lastSlipBonus: boolean;
};

const dateList = (dates: IsoDate[]) => {
  const sorted = [...new Set(dates)].sort();
  const first = sorted.slice(0, 5);
  const more = sorted.length > 5 ? ', …' : '';
  if (first.some((d) => d.slice(0, 7) !== first[0].slice(0, 7))) return `${first.map(longDate).join(', ')}${more}`;
  const month = longDate(first[0]).split(' ').slice(1).join(' ');
  return `${first.map((d) => Number(d.slice(8, 10))).join(', ')}${more} ${month}`;
};

/**
 * Urusan gaji saya (GAJ-108): penahan slip + Perlu Dijelaskan yang belum diisi, dengan siapa yang bertindak.
 * Penahan slip terakhir tidak menyebut isinya ("Menunggu keputusan kantor").
 */
export function payIssuesFrom(facts: PayIssueFacts): PayIssue[] {
  const issues: PayIssue[] = [];
  if (facts.unexplained.length) {
    issues.push({ who: 'YOU', text: `${new Set(facts.unexplained).size} hari belum dijelaskan (${dateList(facts.unexplained)})`, link: '/perlu-dijelaskan' });
  }
  if (facts.clarifications.length) issues.push({ who: 'OFFICE', text: `Penjelasan ${dateList(facts.clarifications)} menunggu keputusan HR`, link: null });
  if (facts.outsideReviews.length) issues.push({ who: 'OFFICE', text: `Absen ${dateList(facts.outsideReviews)} di luar titik sedang ditinjau`, link: null });
  if (facts.overtimeClaims.length) issues.push({ who: 'OFFICE', text: `Klaim lembur ${dateList(facts.overtimeClaims)} menunggu keputusan`, link: null });
  if (facts.noSalary) issues.push({ who: 'OFFICE', text: 'Gaji Anda di periode ini belum diisi kantor', link: null });
  if (facts.lastSlipBonus) issues.push({ who: 'OFFICE', text: 'Menunggu keputusan kantor', link: null });
  return issues;
}

/** Kalimat akibat menurut tanggal (GAJ-108). */
export function issueConsequence(periodStart: IsoDate, today: IsoDate): string {
  return today <= periodEndOf(periodStart)
    ? `Selesaikan sebelum tanggal ${Number(periodEndOf(periodStart).slice(8, 10))} supaya gaji tidak tertahan.`
    : 'Gaji Anda tertahan sampai urusan ini selesai. Slip orang lain tetap dibayar.';
}

export type MyPayment = { kind: 'MONEY' | 'NO_MONEY'; moneyDate: IsoDate; method: 'CASH' | 'TRANSFER' | null; accountTail: string | null };

/** Kalimat status bayar untuk karyawan (GAJ-109): tanpa sumber uang kantor, nama pembayar, dan foto bukti. */
export function paymentText(p: MyPayment): string {
  if (p.kind === 'NO_MONEY') return 'Tidak ada uang yang dibayarkan: seluruhnya terpakai potongan.';
  const how = p.method === 'TRANSFER' ? `transfer${p.accountTail ? ` ke rekening ****${p.accountTail}` : ''}` : 'tunai';
  return `Dibayar ${longDate(p.moneyDate)} lewat ${how}.`;
}

export type MySlipStateKey = 'ESTIMATE' | 'HELD' | 'REOPENED' | 'CLOSED' | 'LATE' | 'PAID' | 'NO_MONEY';

export type MySlipStateInput = {
  periodStart: IsoDate;
  status: 'ESTIMATE' | 'CLOSED';
  /** Slip Perkiraan yang pernah ditutup lalu dibuka kembali. */
  reopened: boolean;
  held: boolean;
  payment: MyPayment | null;
  /** Jatuh bayar (slip Ditutup) atau tanggal bayar yang direncanakan (Perkiraan). */
  due: IsoDate;
  today: IsoDate;
  carried: number;
  /** Alasan buka kembali terakhir (slip sedang dibetulkan). */
  reopenReason: string | null;
};

export const MY_SLIP_STATE_LABELS: Record<MySlipStateKey, string> = {
  ESTIMATE: 'Perkiraan', HELD: 'Tertahan', REOPENED: 'Sedang dibetulkan', CLOSED: 'Ditutup', LATE: 'Belum dibayar', PAID: 'Dibayar', NO_MONEY: 'Tanpa uang',
};

/** Keadaan Slip Saya (spec L4g §3.3) beserta kalimatnya. */
export function mySlipState(input: MySlipStateInput): { key: MySlipStateKey; label: string; text: string } {
  const state = (key: MySlipStateKey, text: string) => ({ key, label: MY_SLIP_STATE_LABELS[key], text });
  if (input.status === 'ESTIMATE') {
    if (input.reopened) return state('REOPENED', `Slip sedang dibetulkan${input.reopenReason ? `: ${input.reopenReason}` : ''}. Angka di bawah perkiraan baru.`);
    if (input.held && input.today > periodEndOf(input.periodStart)) return state('HELD', 'Perkiraan, belum final. Slip tertahan sampai urusan di atas selesai.');
    return state('ESTIMATE', 'Perkiraan, belum final: angka bisa berubah sampai slip ditutup.');
  }
  if (input.payment?.kind === 'NO_MONEY') {
    return state('NO_MONEY', `Tidak ada uang yang dibayarkan: seluruhnya terpakai potongan.${input.carried > 0 ? ` Sisa ${rupiah(input.carried)} dibawa ke slip berikutnya.` : ''}`);
  }
  if (input.payment) return state('PAID', paymentText(input.payment));
  if (input.today > input.due) return state('LATE', `Belum ditandai dibayar. Jatuh bayar ${longDate(input.due)}.`);
  return state('CLOSED', `Ditutup. Jatuh bayar ${longDate(input.due)}.`);
}

export type MyCard = { net: number; estimate: boolean; paid: boolean; cancelled?: boolean };

/** Kepala tiga angka Pendapatan Saya (GAJ-107): pendapatan, sudah diterima, belum diterima. */
export function headline(cards: readonly MyCard[]): { income: number; received: number; pending: number; estimate: boolean } {
  const live = cards.filter((c) => !c.cancelled);
  const income = live.reduce((s, c) => s + c.net, 0);
  const received = live.filter((c) => c.paid).reduce((s, c) => s + c.net, 0);
  return { income, received, pending: income - received, estimate: live.some((c) => c.estimate) };
}

/** Baris Hitungan untuk karyawan: tanpa hari "Dalam toleransi" (KEH-119). */
export function withoutTolerance<T extends { note: string | null }>(days: readonly T[]): T[] {
  return days.filter((d) => d.note !== 'Dalam toleransi');
}

/** Paling banyak 12 slip sekali unduh (GAJ-113). */
export const MAX_SELF_DOWNLOAD = 12;
