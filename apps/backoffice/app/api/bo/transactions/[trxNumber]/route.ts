import { NextResponse } from 'next/server';
import { getAuth } from '@/lib/authz';
import { ReturService } from '@/lib/services/retur-service';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ trxNumber: string }> }
) {
  try {
    const { trxNumber } = await params;
    const payload = await getAuth();

    if (!payload) {
      return NextResponse.json({ error: 'Sesi tidak valid, silakan login kembali' }, { status: 401 });
    }

    // OWNER/GM (`branchScope === 'ALL'`) boleh mencari transaksi cabang mana pun tanpa
    // harus mengganti cabang aktif; selain itu dibatasi ke cabang sendiri.
    const scopedBranchId = payload.branchScope === 'ALL' ? null : payload.branchId;

    const transaction = await ReturService.getTransactionByTrxNumber(trxNumber, scopedBranchId);

    if (!transaction) {
      return NextResponse.json({ error: 'Transaksi tidak ditemukan atau bukan milik cabang ini' }, { status: 404 });
    }

    return NextResponse.json(transaction);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Gagal mengambil data transaksi';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
