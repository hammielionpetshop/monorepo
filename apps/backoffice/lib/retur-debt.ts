/**
 * Aritmetika pemotongan piutang oleh retur — sengaja murni (tanpa DB) supaya bisa diuji
 * sendiri. Ini bagian yang kalau salah menghasilkan angka tagihan yang salah ke pelanggan,
 * jadi ia tidak boleh ikut terkubur di dalam transaksi database.
 */

export type StatusPiutang = 'UNPAID' | 'PARTIAL' | 'PAID' | 'VOIDED';

export type BarisPiutang = {
  id: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

export type PotonganPiutang = {
  debtId: number;
  potongan: number;
  totalAmountBaru: number;
  remainingAmountBaru: number;
  statusBaru: StatusPiutang;
};

export type HasilPemotongan = {
  potongan: PotonganPiutang[];
  totalPotongan: number;
  /** Sisa refund yang tidak menemui piutang — uang tunai yang harus dikembalikan manual. */
  refundTunai: number;
};

function statusDari(totalAmount: number, paidAmount: number, remainingAmount: number): StatusPiutang {
  // Hutang habis tanpa pernah dibayar sepeser pun: barangnya kembali, tagihannya tidak
  // pernah jadi apa-apa. Ini keadaan yang sama dengan yang ditulis transaction-edit-service
  // saat nilai hutang jadi nol, jadi statusnya disamakan — bukan 'PAID', karena tidak ada
  // uang yang pernah masuk dan laporan piutang tidak boleh mengklaim sebaliknya.
  if (totalAmount <= 0 && paidAmount <= 0) return 'VOIDED';
  if (remainingAmount <= 0) return 'PAID';
  if (paidAmount > 0) return 'PARTIAL';
  return 'UNPAID';
}

/**
 * Bagi `refundAmount` ke baris-baris piutang aktif transaksi, berurutan, sampai habis.
 *
 * Yang dipotong adalah SISA hutang, bukan totalnya — kalau pelanggan sudah membayar sebagian,
 * uang yang sudah masuk itu miliknya dan harus dikembalikan sebagai tunai, bukan dihapus dari
 * catatan. Batas `min(refund, sisa)` sekaligus menjaga `total` tidak pernah jatuh di bawah
 * `paid`, sehingga invarian `remaining = total - paid` tetap benar untuk semua kasus.
 */
export function hitungPemotonganPiutang(
  debts: BarisPiutang[],
  refundAmount: number,
): HasilPemotongan {
  let sisaRefund = Math.max(0, Math.round(refundAmount));
  const potongan: PotonganPiutang[] = [];

  for (const debt of debts) {
    if (sisaRefund <= 0) break;
    const sisaHutang = Math.max(0, debt.remainingAmount);
    if (sisaHutang <= 0) continue;

    const dipotong = Math.min(sisaRefund, sisaHutang);
    const totalAmountBaru = debt.totalAmount - dipotong;
    const remainingAmountBaru = sisaHutang - dipotong;

    potongan.push({
      debtId: debt.id,
      potongan: dipotong,
      totalAmountBaru,
      remainingAmountBaru,
      statusBaru: statusDari(totalAmountBaru, debt.paidAmount, remainingAmountBaru),
    });

    sisaRefund -= dipotong;
  }

  const totalPotongan = potongan.reduce((n, p) => n + p.potongan, 0);
  return { potongan, totalPotongan, refundTunai: sisaRefund };
}

/**
 * Kebalikannya, untuk pembatalan retur: kembalikan `jumlah` yang dulu dipotong.
 *
 * Tidak ada `min()` di sini — angkanya diambil dari `returns.debt_reduction_amount`, yaitu
 * yang benar-benar dipotong retur itu, jadi mengembalikannya utuh selalu benar.
 */
export function hitungPengembalianPiutang(
  debt: BarisPiutang,
  jumlah: number,
): Omit<PotonganPiutang, 'potongan'> & { pengembalian: number } {
  const pengembalian = Math.max(0, Math.round(jumlah));
  const totalAmountBaru = debt.totalAmount + pengembalian;
  const remainingAmountBaru = debt.remainingAmount + pengembalian;

  return {
    debtId: debt.id,
    pengembalian,
    totalAmountBaru,
    remainingAmountBaru,
    statusBaru: statusDari(totalAmountBaru, debt.paidAmount, remainingAmountBaru),
  };
}
