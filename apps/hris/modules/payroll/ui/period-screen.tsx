import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Alert, Badge, Card } from '@/components/ui/surface';
import type { SlipHold, SlipStatus } from '../rules/payslip';
import { rupiah } from '../rules/salary';

type Row = {
  slipId: number; employeeId: number; name: string; positionName: string; branchName: string; status: SlipStatus; statusLabel: string;
  number: string | null; version: number; income: number | null; taken: number | null; net: number | null; carried: number;
  lastSlip: boolean; holds: SlipHold[]; ready: boolean;
};
type HistoryRow = { id: number; action: string; at: string; by: string; reason: string | null; text: string };

export type PeriodTab = 'slip' | 'tertahan' | 'riwayat';

/** GAJ-L28 satu periode: tab Slip, Tertahan, Tiadakan Potongan (tautan), Riwayat; Tutup semua yang siap dan Cetak. */
export function PeriodScreen({ period, window: win, counts, rows, history, can, tab, filter }: {
  period: { start: string; label: string };
  window: { opensText: string; open: boolean; testMode: boolean };
  counts: { estimate: number; held: number; closed: number };
  rows: Row[]; history: HistoryRow[]; can: { close: boolean };
  tab: PeriodTab; filter: { status: string | null; branch: string | null };
}) {
  const base = `/gaji/periode/${period.start}`;
  const readyCount = rows.filter((r) => r.ready).length;
  const branches = [...new Set(rows.map((r) => r.branchName))].sort();
  const shown = rows.filter((r) => (!filter.status || r.status === filter.status) && (!filter.branch || r.branchName === filter.branch));
  const tabLink = (key: PeriodTab, label: string) => (
    <Link href={`${base}?tab=${key}`} className={buttonClass({ variant: tab === key ? 'secondary' : 'ghost', size: 'sm' })}>{label}</Link>
  );
  return (
    <div className="space-y-4">
      <Card className="space-y-2 text-sm">
        <div className="flex flex-wrap gap-4">
          <span>Perkiraan: <b>{counts.estimate}</b></span>
          <span>Tertahan: <b>{counts.held}</b></span>
          <span>Ditutup: <b>{counts.closed}</b></span>
          <span>Tombol Tutup aktif mulai {win.opensText}</span>
        </div>
        {win.testMode && <Alert tone="warn">Mode uji staging: slip periode ini boleh ditutup sebelum tanggalnya. Di produksi tombol Tutup baru aktif mulai {win.opensText}.</Alert>}
        <div className="flex flex-wrap gap-2">
          {can.close && readyCount > 0
            ? <Link className={buttonClass({})} href={`${base}/tutup`}>Tutup semua yang siap ({readyCount})</Link>
            : <span className={buttonClass({ variant: 'secondary' })} aria-disabled="true">{win.open ? `Tutup semua yang siap (${readyCount})` : `Aktif mulai ${win.opensText}`}</span>}
          {counts.closed > 0 && <Link className={buttonClass({ variant: 'secondary' })} href={`${base}/cetak`} target="_blank">Cetak semua yang ditutup</Link>}
        </div>
      </Card>

      <nav className="flex flex-wrap gap-2" aria-label="Tab periode">
        {tabLink('slip', 'Slip')}
        {tabLink('tertahan', `Tertahan (${counts.held})`)}
        <Link href={`/gaji/tiadakan?periode=${period.start}`} className={buttonClass({ variant: 'ghost', size: 'sm' })}>Tiadakan Potongan</Link>
        {tabLink('riwayat', 'Riwayat')}
      </nav>

      {tab === 'slip' && (
        <>
          <form className="flex flex-wrap items-end gap-2" method="get">
            <input type="hidden" name="tab" value="slip" />
            <select name="status" defaultValue={filter.status ?? ''} className="min-h-11 rounded-md border border-line px-3" aria-label="Status">
              <option value="">Semua status</option>
              <option value="ESTIMATE">Perkiraan</option>
              <option value="CLOSED">Ditutup</option>
            </select>
            <select name="cabang" defaultValue={filter.branch ?? ''} className="min-h-11 rounded-md border border-line px-3" aria-label="Cabang">
              <option value="">Semua cabang</option>
              {branches.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
            <button type="submit" className={buttonClass({ variant: 'secondary' })}>Saring</button>
          </form>
          <DataList
            rows={shown}
            rowKey={(r) => r.slipId}
            empty="Tidak ada slip."
            columns={[
              { key: 'name', header: 'Nama', primary: true, render: (r) => <Link className="underline" href={`/gaji/slip/${r.slipId}`}>{r.name}</Link> },
              { key: 'pos', header: 'Jabatan · cabang', render: (r) => `${r.positionName} · ${r.branchName}` },
              { key: 'status', header: 'Status', render: (r) => <Status row={r} /> },
              { key: 'income', header: 'Pendapatan', render: (r) => (r.income == null ? '—' : rupiah(r.income)) },
              { key: 'taken', header: 'Terpotong', render: (r) => (r.taken == null ? '—' : rupiah(r.taken)) },
              { key: 'net', header: 'Bersih', render: (r) => (r.net == null ? 'Belum ada gaji' : <b className="tabular-nums">{rupiah(r.net)}</b>) },
            ]}
          />
        </>
      )}

      {tab === 'tertahan' && (
        <DataList
          rows={rows.flatMap((r) => r.holds.map((h, i) => ({ key: `${r.slipId}-${i}`, row: r, hold: h })))}
          rowKey={(x) => x.key}
          empty="Tidak ada slip yang tertahan."
          columns={[
            { key: 'name', header: 'Nama', primary: true, render: (x) => <Link className="underline" href={`/gaji/slip/${x.row.slipId}`}>{x.row.name}</Link> },
            { key: 'hold', header: 'Penahan', render: (x) => x.hold.text },
            { key: 'resolver', header: 'Penyelesai', render: (x) => x.hold.resolver },
            { key: 'go', header: '', render: (x) => <Link className="underline" href={x.hold.link}>Buka urusannya</Link> },
          ]}
        />
      )}

      {tab === 'riwayat' && (
        <DataList
          rows={history}
          rowKey={(h) => h.id}
          empty="Belum ada langkah slip di periode ini."
          columns={[
            { key: 'at', header: 'Kapan', primary: true, render: (h) => h.at },
            { key: 'by', header: 'Oleh', render: (h) => h.by },
            { key: 'text', header: 'Apa', render: (h) => h.text },
          ]}
        />
      )}
    </div>
  );
}

function Status({ row }: { row: Row }) {
  return (
    <span className="flex flex-wrap gap-1">
      <Badge tone={row.status === 'CLOSED' ? 'ok' : row.holds.length ? 'warn' : 'info'}>{row.holds.length ? 'Tertahan' : row.statusLabel}</Badge>
      {row.number && <span className="text-xs text-ink-muted">{row.number}</span>}
      {row.lastSlip && <Badge tone="info">Slip terakhir</Badge>}
      {row.version > 1 && <Badge tone="info">Versi {row.version}</Badge>}
      {row.carried > 0 && <Badge tone="warn">Sisa dibawa {rupiah(row.carried)}</Badge>}
    </span>
  );
}
