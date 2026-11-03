import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Alert, Badge } from '@/components/ui/surface';
import { rupiah } from '../rules/salary';

type Row = { slipId: number; name: string; bank: string | null; accountNumber: string | null; accountHolder: string | null; net: number };

/** GAJ-L36 Daftar Transfer: slip Ditutup belum Dibayar, tanpa jabatan bertanda, urut per bank; unduh CSV. Tanpa tombol Bayar. */
export function TransferScreen({ period, rows, total }: { period: { start: string; label: string }; rows: Row[]; total: number }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Link className={buttonClass({ variant: 'ghost' })} href="/gaji/jadwal-bayar">Kembali ke Jadwal Bayar</Link>
        {rows.length > 0 && <a className={buttonClass({})} href={`/api/payroll/transfer?period=${period.start}`}>Unduh CSV (Excel)</a>}
      </div>
      <Alert tone="info">
        Hanya slip yang sudah ditutup dan belum ditandai Dibayar. Gaji jabatan bertanda &quot;Gaji hanya terlihat Pemilik dan GM&quot; tidak ada di sini.
        Sesudah transfer, Pemilik atau GM menandai Dibayar di Jadwal Bayar. Tiap buka dan unduh daftar ini dicatat.
      </Alert>
      <DataList
        rows={rows}
        rowKey={(r) => r.slipId}
        empty="Tidak ada slip yang menunggu transfer."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (r) => r.name },
          { key: 'bank', header: 'Bank', render: (r) => r.bank ?? '—' },
          { key: 'acc', header: 'Nomor rekening', render: (r) => (r.accountNumber ? <span className="tabular-nums">{r.accountNumber}</span> : <Badge tone="warn">Belum ada rekening: bayar tunai atau lengkapi rekening</Badge>) },
          { key: 'holder', header: 'Nama pemilik rekening', render: (r) => r.accountHolder ?? '—' },
          { key: 'net', header: 'Bersih', render: (r) => <b className="tabular-nums">{rupiah(r.net)}</b> },
        ]}
      />
      {rows.length > 0 && <p className="text-sm">Jumlah {rows.length} orang · <b className="tabular-nums">{rupiah(total)}</b></p>}
    </div>
  );
}
