/**
 * Aritmetika pembagian satu pembayaran global ke banyak baris piutang, berurutan dari
 * yang paling lama. Sengaja murni (tanpa DB) supaya bisa diuji sendiri — ini bagian yang
 * kalau salah menghasilkan sisa hutang yang salah ke pelanggan.
 *
 * Berbeda dengan pemotongan retur (`retur-debt.ts`): pembayaran MENAMBAH `paidAmount` dan
 * mengurangi `remainingAmount`; `totalAmount` tidak pernah berubah.
 */

export type BarisHutangBayar = {
  id: number;
  /** Dipakai untuk mengurutkan lama → baru. */
  createdAt: string | Date;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: string;
};

export type AlokasiBayar = {
  debtId: number;
  bayar: number;
  paidAmountBaru: number;
  remainingAmountBaru: number;
  statusBaru: 'PARTIAL' | 'PAID';
};

export type HasilAlokasiBayar = {
  alokasi: AlokasiBayar[];
  totalDialokasikan: number;
  /** Sisa nominal yang tidak menemui piutang. Harus 0 kalau nominal <= total sisa hutang. */
  sisaTakTeralokasi: number;
};

function waktu(v: string | Date): number {
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Bagi `amount` ke baris piutang aktif, dari yang paling lama dibuat ke yang paling baru,
 * sampai nominalnya habis. Baris yang sudah `PAID`/`VOIDED` atau tak bersisa dilewati.
 *
 * Batas `min(sisaAmount, remaining)` menjaga `remaining` tidak pernah jatuh di bawah nol,
 * sehingga invarian `remaining = total - paid` tetap benar.
 */
export function alokasiPembayaranHutang(
  debts: BarisHutangBayar[],
  amount: number,
): HasilAlokasiBayar {
  let sisa = Math.max(0, Math.round(amount));

  const urut = [...debts]
    .filter((d) => d.status !== 'PAID' && d.status !== 'VOIDED' && d.remainingAmount > 0)
    .sort((a, b) => waktu(a.createdAt) - waktu(b.createdAt) || a.id - b.id);

  const alokasi: AlokasiBayar[] = [];

  for (const debt of urut) {
    if (sisa <= 0) break;

    const bayar = Math.min(sisa, debt.remainingAmount);
    const paidAmountBaru = debt.paidAmount + bayar;
    const remainingAmountBaru = debt.remainingAmount - bayar;

    alokasi.push({
      debtId: debt.id,
      bayar,
      paidAmountBaru,
      remainingAmountBaru,
      statusBaru: remainingAmountBaru <= 0 ? 'PAID' : 'PARTIAL',
    });

    sisa -= bayar;
  }

  const totalDialokasikan = alokasi.reduce((n, a) => n + a.bayar, 0);
  return { alokasi, totalDialokasikan, sisaTakTeralokasi: sisa };
}
