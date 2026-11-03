'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/salary';

type Status = 'OPEN' | 'WRITTEN_OFF' | 'REVERSED' | 'SETTLED';
const STATUS: Record<Status, { label: string; tone: 'info' | 'ok' | 'warn' | 'danger' }> = {
  OPEN: { label: 'Terbuka', tone: 'warn' }, WRITTEN_OFF: { label: 'Dihapuskan', tone: 'info' }, REVERSED: { label: 'Dibalik (slip dibuka kembali)', tone: 'info' },
  SETTLED: { label: 'Lunas (dipotong bayar di luar slip)', tone: 'ok' },
};

type Row = {
  id: number; employeeId: number; name: string; slipId: number; number: string | null; period: string; group: string; amount: number; settled: number; remaining: number;
  status: Status; statusLabel: string; reason: string | null; decided: string | null; canWriteOff: boolean;
};

/** Piutang Lain (GAJ-82, 96): sisa (b) dan (c) dari slip terakhir; Hapuskan oleh Pemilik/GM dengan alasan. */
export function ReceivablesScreen({ rows, filter, manage, totalOpen, countOpen }: {
  rows: Row[]; filter: { status: Status | null }; manage: boolean; totalOpen: number; countOpen: number;
}) {
  const [target, setTarget] = useState<Row | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm">Terbuka: <b className="tabular-nums">{countOpen}</b> piutang, jumlah <b className="tabular-nums">{rupiah(totalOpen)}</b>.</p>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="rc-status" label="Status">
          <Select id="rc-status" name="status" defaultValue={filter.status ?? ''}>
            <option value="">Semua</option>
            {(Object.keys(STATUS) as Status[]).map((s) => <option key={s} value={s}>{STATUS[s].label}</option>)}
          </Select>
        </Field>
        <Button type="submit" variant="secondary">Tampilkan</Button>
      </form>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty="Belum ada Piutang Lain."
        columns={[
          { key: 'name', header: 'Orang', primary: true, render: (r) => r.name },
          { key: 'slip', header: 'Slip', render: (r) => <Link className="underline" href={`/gaji/slip/${r.slipId}`}>{r.number ?? '-'}</Link> },
          { key: 'period', header: 'Periode', render: (r) => r.period },
          { key: 'group', header: 'Kelompok', render: (r) => r.group },
          { key: 'amount', header: 'Nominal', render: (r) => <span className="tabular-nums">{rupiah(r.amount)}</span> },
          {
            key: 'settled', header: 'Dipotong bayar di luar slip', render: (r) => (r.settled
              ? <span className="tabular-nums">{rupiah(r.settled)} · sisa {rupiah(r.remaining)}</span>
              : <span className="text-ink-muted">—</span>),
          },
          {
            key: 'status', header: 'Status', render: (r) => (
              <span>
                <Badge tone={STATUS[r.status].tone}>{r.statusLabel}</Badge>
                {r.decided && <span className="block text-xs text-ink-muted">{r.decided}{r.reason ? ` · ${r.reason}` : ''}</span>}
              </span>
            ),
          },
          { key: 'act', header: '', render: (r) => (r.canWriteOff ? <Button size="sm" variant="ghost" onClick={() => setTarget(r)}>Hapuskan</Button> : null) },
        ]}
      />
      <p className="text-sm text-ink-muted">
        Piutang Lain lahir saat slip terakhir ditutup: sisa kehilangan barang, minus kas, dan Potongan Lain yang tidak tertampung gaji terakhir.
        Sisa telat, tidak hadir, dan denda tidak menjadi piutang (Tidak tertagih). {manage ? 'Hapuskan bila tidak akan ditagih.' : 'Hanya Pemilik atau GM yang menghapuskan.'}
      </p>
      {target && <WriteOffDialog row={target} onClose={() => setTarget(null)} />}
    </div>
  );
}

function WriteOffDialog({ row, onClose }: { row: Row; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'receivable_write_off', id: row.id, reason: reason.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Piutang dihapuskan. Pemilik lain diberi tahu.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title="Hapuskan Piutang Lain"
      footer={<><Button variant="secondary" onClick={onClose}>Kembali</Button><HoldButton variant="danger" loading={busy} disabled={reason.trim().length < 15} onClick={save}>Hapuskan</HoldButton></>}>
      <div className="space-y-3 text-sm">
        <p>{row.name} · {row.group} · <b className="tabular-nums">{rupiah(row.amount)}</b> (slip {row.number}).</p>
        <p className="text-ink-muted">Sesudah dihapuskan, slip asalnya tidak bisa dibuka kembali.</p>
        <Field id="rc-reason" label="Alasan" hint="Paling sedikit 15 huruf."><Textarea id="rc-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
