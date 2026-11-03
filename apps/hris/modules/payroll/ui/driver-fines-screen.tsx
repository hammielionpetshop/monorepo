'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { FINE_TAB_LABELS, type FineStatus, type FineTab } from '../rules/driver-fines';
import { longDate, rupiah } from '../rules/salary';

const TONE: Record<FineStatus, 'info' | 'ok' | 'warn' | 'danger'> = {
  PENDING: 'warn', ACTIVE: 'ok', REJECTED: 'danger', WITHDRAWN: 'info', CANCELLED: 'danger', WAIVED: 'info',
};

type Row = {
  id: number; name: string; kindName: string; occurredOn: string; tripNumber: string | null; description: string; amount: number;
  status: FineStatus; statusLabel: string; recordedBy: string; approvedBy: string | null; requestId: number | null; endReason: string | null;
  cut: { label: string; slipNumber: string | null } | null; endAction: 'CANCEL' | 'WAIVE' | null;
};

/** Denda Driver & Kenek (spec L7 §4): Menunggu, Berlaku, Selesai. */
export function DriverFinesScreen({ tab, counts, rows, canPropose, direct }: {
  tab: FineTab; counts: Record<FineTab, number>; rows: Row[]; canPropose: boolean; direct: boolean;
}) {
  const [target, setTarget] = useState<Row | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(FINE_TAB_LABELS) as FineTab[]).map((t) => (
          <Link key={t} href={t === 'PENDING' ? '/gaji/denda-driver' : `/gaji/denda-driver?tab=${t}`} className={buttonClass({ variant: t === tab ? 'primary' : 'secondary', size: 'sm' })}>
            {FINE_TAB_LABELS[t]} ({counts[t]})
          </Link>
        ))}
        {canPropose && <Link className={buttonClass({})} href="/gaji/denda-driver/ajukan">{direct ? 'Catat denda' : 'Ajukan denda'}</Link>}
      </div>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty={tab === 'PENDING' ? 'Tidak ada usulan denda yang menunggu.' : 'Belum ada denda.'}
        columns={[
          { key: 'name', header: 'Orang', primary: true, render: (r) => r.name },
          { key: 'date', header: 'Tanggal', render: (r) => <span>{longDate(r.occurredOn)}{r.tripNumber && <span className="text-ink-muted"> · {r.tripNumber}</span>}</span> },
          { key: 'kind', header: 'Jenis', render: (r) => r.kindName },
          { key: 'amount', header: 'Nominal', render: (r) => <span className="tabular-nums">{rupiah(r.amount)}</span> },
          {
            key: 'detail', header: 'Uraian', render: (r) => (
              <details className="text-sm"><summary className="cursor-pointer">Lihat</summary>
                <p>{r.description}</p>
                <p className="text-ink-muted">Dicatat {r.recordedBy}{r.approvedBy && r.approvedBy !== r.recordedBy ? ` · disahkan ${r.approvedBy}` : ''}</p>
                {r.endReason && <p className="text-ink-muted">Alasan: {r.endReason}</p>}
              </details>
            ),
          },
          {
            key: 'status', header: 'Status', render: (r) => (
              <span className="flex flex-col gap-1">
                <Badge tone={TONE[r.status]}>{r.statusLabel}</Badge>
                {r.cut && <span className="text-xs text-ink-muted">{r.cut.label}{r.cut.slipNumber ? ` · ${r.cut.slipNumber}` : ''}</span>}
              </span>
            ),
          },
          {
            key: 'act', header: '', render: (r) => (r.status === 'PENDING' && r.requestId
              ? <Link className="underline text-sm" href={`/persetujuan/${r.requestId}`}>Lihat usulan</Link>
              : r.endAction ? <Button size="sm" variant="ghost" onClick={() => setTarget(r)}>{r.endAction === 'WAIVE' ? 'Tiadakan' : 'Batalkan'}</Button> : null),
          },
        ]}
      />
      <p className="text-sm text-ink-muted">
        Denda dipotong di slip utama periode tanggal kejadian; bila slip itu sudah ditutup, di slip utama berikutnya. Sebelum terpotong, Pemilik atau GM bisa Batalkan;
        sesudah terpotong, Tiadakan = uangnya dikembalikan di slip utama berikutnya. Yang terpotong masuk Dana Disiplin.
      </p>
      <EndDialog target={target} onClose={() => setTarget(null)} />
    </div>
  );
}

function EndDialog({ target, onClose }: { target: Row | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!target) return null;
  const waive = target.endAction === 'WAIVE';
  function close() { setReason(''); setError(null); onClose(); }
  async function save() {
    setBusy(true);
    const result = await postJson('/api/payroll/fines', { kind: 'fine_end', id: target!.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(waive ? 'Denda ditiadakan; uangnya kembali di slip utama berikutnya.' : 'Denda dibatalkan. Orangnya diberi tahu.', 'ok');
    close();
    router.refresh();
  }
  return (
    <Dialog open onClose={close} title={waive ? 'Tiadakan denda' : 'Batalkan denda'}
      footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton variant="danger" loading={busy} disabled={!reason.trim()} onClick={save}>{waive ? 'Tiadakan' : 'Batalkan'}</HoldButton></>}>
      <div className="space-y-3">
        <p>{target.kindName} {target.name} {rupiah(target.amount)} ({longDate(target.occurredOn)}).</p>
        <p className="text-ink-muted">{waive ? 'Denda ini sudah terpotong. Ditiadakan = dikembalikan sebagai tambahan di slip utama berikutnya dan keluar dari Dana Disiplin.' : 'Denda ini belum terpotong dan tidak akan dipotong.'}</p>
        <Field id="df-reason" label="Alasan"><Textarea id="df-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
