'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import type { ToRecordRow } from '../server/store-payments';

function RecordCard({ row, onRecord }: { row: ToRecordRow; onRecord?: (row: ToRecordRow) => void }) {
  return (
    <Card className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="inline-flex flex-wrap items-center gap-1">
            <Badge tone={row.decision === 'CUT' ? 'warn' : 'info'}>{row.label}</Badge>
            <span className="font-medium tabular-nums">{row.noteNumber}</span>
            {row.amount != null && <b className="tabular-nums">{rupiah(row.amount)}</b>}
            {row.reasonLabel && <span>({row.reasonLabel})</span>}
            {row.red && <Badge tone="danger">Lewat {row.days} hari</Badge>}
          </p>
          <p className="text-sm">
            <Link href={`/logistik/toko/${row.customerId}`} className="underline">{row.store}</Link>
            <span className="text-ink-muted"> · trip <Link href={`/logistik/trip/${row.tripId}`} className="underline">{row.tripNumber}</Link></span>
          </p>
          <p className="text-sm text-ink-muted">
            Laporan {row.reportLabel}{row.reportNote ? `: ${row.reportNote}` : ''} · <a href={row.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto</a>
          </p>
          {row.note && <p className="text-sm">{row.note}</p>}
          <p className="text-xs text-ink-muted">
            Diputuskan {row.by} {row.on}{row.changes > 0 ? ` · diubah ${row.changes}×` : ''}
            {row.recorded ? ` · dicatat ${row.recorded.by} ${row.recorded.on}: ${row.recorded.ref}` : ''}
          </p>
        </div>
        {onRecord && <Button size="sm" onClick={() => onRecord(row)}>Sudah dicatat</Button>}
      </div>
    </Card>
  );
}

/**
 * Perlu dicatat di kasir (spec LT1 §14.2 butir 3): keputusan Potong nota / Retur BO yang belum dicatat Finance di kasir
 * (paling lama di atas, merah lewat batas hari). Sudah dicatat wajib nomor referensi; sesudahnya keputusan terkunci.
 */
export function ToRecordScreen({ waiting, done, redDays }: { waiting: ToRecordRow[]; done: ToRecordRow[]; redDays: number }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<ToRecordRow | null>(null);
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', { action: 'record_decision', decisionId: target.id, ref });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`${target.noteNumber ?? 'Nota'} ditandai sudah dicatat di kasir.`, 'ok');
    setTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Potong nota: kurangi nota di kasir sebesar nominalnya. Retur BO: buat Retur di Back Office (nilainya diisi di sana). Sesudah itu tekan
        Sudah dicatat dan isi nomor retur / keterangan. Merah = lebih dari {redDays} hari sejak diputuskan.
      </p>
      <h2 className="font-semibold">Belum dicatat ({waiting.length})</h2>
      {!waiting.length ? <EmptyState title="Tidak ada keputusan yang perlu dicatat di kasir." /> : (
        <ul className="space-y-2">{waiting.map((r) => <li key={r.id}><RecordCard row={r} onRecord={(row) => { setRef(''); setError(null); setTarget(row); }} /></li>)}</ul>
      )}
      {done.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">30 terakhir yang sudah dicatat</summary>
          <ul className="mt-2 space-y-2">{done.map((r) => <li key={r.id}><RecordCard row={r} /></li>)}</ul>
        </details>
      )}
      <Dialog
        open={!!target} onClose={() => setTarget(null)} title={target ? `Sudah dicatat: ${target.noteNumber ?? ''} ${target.store}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setTarget(null)}>Batal</Button><Button loading={busy} disabled={ref.trim().length < 3} onClick={save}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="record-ref" label="Nomor retur / keterangan pencatatan" hint="Sesudah disimpan, keputusan ini tidak bisa diubah lagi.">
            <Input id="record-ref" value={ref} maxLength={100} onChange={(e) => setRef(e.target.value)} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
