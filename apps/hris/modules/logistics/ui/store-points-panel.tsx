'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { POINT_STATUS_TONES } from '../rules/store-points';
import type { PointRow } from '../server/store-points';

function PointLine({ row }: { row: PointRow }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-sm">
      <a href={row.mapUrl} target="_blank" rel="noreferrer" className="underline">Buka peta</a>
      <span className="text-ink-muted tabular-nums">{row.latitude.toFixed(6)}, {row.longitude.toFixed(6)}</span>
      {row.accuracyM != null && <span className="text-ink-muted">· akurasi {row.accuracyM} m</span>}
      {row.photoUrl && <a href={row.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto depan toko</a>}
    </span>
  );
}

/** Setujui / Tolak satu usulan (spec LT1 §13.4 butir 2). */
function DecideButtons({ row }: { row: PointRow }) {
  const router = useRouter();
  const toast = useToast();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(decision: 'APPROVE' | 'REJECT') {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics/stores', { action: 'decide_point', pointId: row.id, decision, reason: decision === 'REJECT' ? reason : '' });
    setBusy(false);
    if (!result.ok) {
      if (decision === 'APPROVE') toast(result.error ?? 'Gagal menyimpan.', 'danger');
      else setError(result.error ?? 'Gagal menyimpan.');
      return;
    }
    toast(decision === 'APPROVE' ? `Titik ${row.store} disetujui.` : `Titik ${row.store} ditolak.`, 'ok');
    setRejecting(false);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap gap-1">
        <Button size="sm" loading={busy && !rejecting} onClick={() => run('APPROVE')}>Setujui</Button>
        <Button size="sm" variant="danger" disabled={busy} onClick={() => { setReason(''); setError(null); setRejecting(true); }}>Tolak</Button>
      </div>
      <Dialog
        open={rejecting} onClose={() => setRejecting(false)} title={`Tolak titik ${row.store}`}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setRejecting(false)}>Batal</Button><Button variant="danger" loading={busy} onClick={() => run('REJECT')}>Tolak</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <p className="text-sm">{row.by} diberi tahu alasannya. {row.kindLabel === 'Laporan titik salah' ? 'Titik lama tetap dipakai.' : 'Toko tetap tanpa titik.'}</p>
          <Field id={`reject-${row.id}`} label="Alasan">
            <Textarea id={`reject-${row.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} placeholder="Contoh: foto bukan toko ini, titik di jalan raya" />
          </Field>
        </div>
      </Dialog>
    </>
  );
}

/** Tab Titik menunggu di Data Toko (spec LT1 §13.4 butir 2): paling lama di atas. */
export function PendingPointsList({ rows, canDecide }: { rows: PointRow[]; canDecide: boolean }) {
  if (!rows.length) return <EmptyState title="Tidak ada titik toko yang menunggu persetujuan." />;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id}>
          <Card className="space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="space-y-1">
                <p className="inline-flex flex-wrap items-center gap-1">
                  <Link href={`/logistik/toko/${r.customerId}`} className="font-medium underline">{r.store}</Link>
                  <Badge tone={r.kindLabel === 'Laporan titik salah' ? 'warn' : 'info'}>{r.kindLabel}</Badge>
                </p>
                <p className="text-sm text-ink-muted">{r.by} · {r.on} {r.at}{r.tripNumber ? ` · trip ${r.tripNumber}` : ''}</p>
                {r.reason && <p className="text-sm">Alasan: {r.reason}</p>}
                <PointLine row={r} />
                {r.fromCurrentM != null && <p className="text-sm text-ink-muted">± {r.fromCurrentM} m dari titik yang sekarang dipakai.</p>}
              </div>
              {canDecide && <DecideButtons row={r} />}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}

/** Kartu Titik toko di rincian toko (spec LT1 §13.4): titik sekarang, usulan menunggu, Tempel koordinat, riwayat. */
export function StorePointCard({ customerId, name, approved, pending, history, canDecide }: {
  customerId: number; name: string; approved: PointRow | null; pending: PointRow | null; history: PointRow[]; canDecide: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function paste() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics/stores', { action: 'paste_point', customerId, text });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Titik ${name} tersimpan.`, 'ok');
    setOpen(false);
    router.refresh();
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">Titik toko <NewBadge feature="fitur/titik-toko" /></h2>
        {canDecide && (
          <Button size="sm" variant="secondary" onClick={() => { setText(''); setError(null); setOpen(true); }}>
            {approved ? 'Ganti dengan koordinat' : 'Tempel koordinat'}
          </Button>
        )}
      </div>
      {approved ? (
        <div className="space-y-1">
          <Badge tone="ok">Disetujui</Badge>
          <PointLine row={approved} />
          <p className="text-xs text-ink-muted">
            {approved.sourceLabel === 'ditempel kantor' ? `Ditempel ${approved.by}` : `Dipasang ${approved.by}${approved.tripNumber ? ` (trip ${approved.tripNumber})` : ''}`}
            {approved.decidedAt ? `, disetujui ${approved.decidedBy ?? '-'} ${approved.decidedAt}` : ''}.
          </p>
        </div>
      ) : <p className="text-sm text-ink-muted">Belum ada titik. Driver memasangnya dari kunjungan di Trip Saya, atau tempel koordinat dari Google Maps.</p>}
      {pending && (
        <div className="space-y-2 rounded-lg border border-line p-2">
          <p className="inline-flex flex-wrap items-center gap-1 text-sm">
            <Badge tone="warn">Menunggu</Badge> {pending.kindLabel} dari {pending.by} · {pending.on} {pending.at}
          </p>
          {pending.reason && <p className="text-sm">Alasan: {pending.reason}</p>}
          <PointLine row={pending} />
          {pending.fromCurrentM != null && <p className="text-sm text-ink-muted">± {pending.fromCurrentM} m dari titik sekarang.</p>}
          {pending && canDecide && <DecideButtons row={pending} />}
        </div>
      )}
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted">Riwayat titik ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-1">
                <Badge tone={POINT_STATUS_TONES[h.status]}>{h.statusLabel}</Badge>
                <span>{h.kindLabel}, {h.sourceLabel}, {h.by} · {h.on}</span>
                {h.rejectReason && <span className="text-ink-muted">· {h.rejectReason}</span>}
                <a href={h.mapUrl} target="_blank" rel="noreferrer" className="underline">peta</a>
              </li>
            ))}
          </ul>
        </details>
      )}
      <Dialog
        open={open} onClose={() => setOpen(false)} title={`Titik ${name}`}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} onClick={paste}>Simpan titik</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field
            id="paste-point" label="Koordinat atau tautan Google Maps"
            hint="Di Google Maps tekan lama titik toko, salin angka koordinatnya (contoh: -7.35050, 108.10860), lalu tempel di sini. Titik langsung dipakai tanpa foto."
          >
            <Input id="paste-point" value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} />
          </Field>
          {(approved || pending) && <Alert tone="warn">{approved ? 'Titik lama menjadi Diganti. ' : ''}{pending ? 'Usulan yang menunggu ikut ditolak.' : ''}</Alert>}
        </div>
      </Dialog>
    </Card>
  );
}
