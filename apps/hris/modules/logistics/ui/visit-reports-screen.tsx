'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { ReportRow } from '../server/store-payments';

function ReportCard({ row, onClose }: { row: ReportRow; onClose?: (row: ReportRow) => void }) {
  return (
    <Card className="space-y-1">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <p className="inline-flex flex-wrap items-center gap-1">
            <Badge tone={row.kind === 'RETURN' ? 'info' : 'warn'}>{row.label}</Badge>
            <Link href={`/logistik/toko/${row.customerId}`} className="font-medium underline">{row.store}</Link>
          </p>
          <p className="text-sm text-ink-muted">
            {row.by} · {row.on} {row.at} · trip <Link href={`/logistik/trip/${row.tripId}`} className="underline">{row.tripNumber}</Link>
            {row.carriedBack ? ' · barang dibawa pulang' : ''}
          </p>
          {row.note && <p className="text-sm">{row.note}</p>}
          <a href={row.photoUrl} target="_blank" rel="noreferrer" className="text-sm underline">Foto</a>
          {row.closed && <p className="text-sm text-ink-muted">Selesai ({row.closedBy}): {row.closeNote}</p>}
        </div>
        {onClose && <Button size="sm" onClick={() => onClose(row)}>Selesai</Button>}
      </div>
    </Card>
  );
}

/** Laporan Toko (spec LT1 §13.5 butir 5): kantor memutuskan potong nota di Back Office, lalu menandai Selesai dengan catatan. */
export function VisitReportsScreen({ open, closed, canClose }: { open: ReportRow[]; closed: ReportRow[]; canClose: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<ReportRow | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', { action: 'close_visit_report', reportId: target.id, note });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Laporan ${target.store} selesai.`, 'ok');
    setTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Laporan driver sesudah Terkirim: barang salah, kurang, rusak, retur, dan kendala lain. Potong atau koreksi nota dilakukan di Back Office;
        HRIS tidak mengubah nota.
      </p>
      <h2 className="font-semibold">Belum selesai ({open.length})</h2>
      {!open.length ? <EmptyState title="Tidak ada laporan toko yang menunggu." /> : (
        <ul className="space-y-2">{open.map((r) => <li key={r.id}><ReportCard row={r} onClose={canClose ? (row) => { setNote(''); setError(null); setTarget(row); } : undefined} /></li>)}</ul>
      )}
      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">30 laporan terakhir yang sudah selesai</summary>
          <ul className="mt-2 space-y-2">{closed.map((r) => <li key={r.id}><ReportCard row={r} /></li>)}</ul>
        </details>
      )}
      <Dialog
        open={!!target} onClose={() => setTarget(null)} title={target ? `Selesai: ${target.label} ${target.store}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setTarget(null)}>Batal</Button><Button loading={busy} onClick={close}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="report-close" label="Catatan keputusan" hint="Contoh: nota dipotong Rp 20.000 di Back Office; barang diganti trip besok.">
            <Textarea id="report-close" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
