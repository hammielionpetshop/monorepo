'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { PendingRow } from '../server/returned-goods';

const STATUS_LABELS = { WAITING: 'Menunggu dikirim', ON_TRIP: 'Dalam perjalanan' } as const;

/**
 * Tab Tertunda (LOG-57, spec LT1 §14.1 butir 3): surat jalan yang pernah Kirim Besok dan belum terkirim, paling lama di
 * atas; merah lewat batas hari. Tutup = sudah ditindaklanjuti (keterangan wajib); surat jalan tetap di antreannya.
 */
export function PendingNotesScreen({ rows, redDays, canClose, closed }: {
  rows: PendingRow[]; redDays: number; canClose: boolean; closed: { noteId: number; number: string; note: string; on: string; at: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<PendingRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function close() {
    if (!target) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', { action: 'close_pending', noteId: target.noteId, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Tertunda ${target.number} ditutup.`, 'ok');
    setTarget(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-muted">
        Surat jalan yang pernah <b>Kirim Besok</b> (atau dikirim ulang sesudah Gagal) dan belum terkirim, paling lama di atas. Merah bila lebih dari
        {' '}{redDays} hari sejak pertama tertunda. <b>Tutup</b> bila sudah ditindaklanjuti (mis. toko sudah dihubungi); surat jalan tetap di antrean,
        dan Kirim Besok berikutnya memunculkannya lagi.
      </p>
      <DataList
        rows={rows}
        rowKey={(r) => String(r.noteId)}
        empty="Tidak ada surat jalan yang tertunda."
        columns={[
          {
            key: 'number', header: 'Nomor', primary: true,
            render: (r) => (
              <span className="inline-flex flex-wrap items-center gap-1">
                <span className="font-medium">{r.number}</span>
                <Badge tone={r.kind === 'SALE' ? 'info' : 'ok'}>{r.kind === 'SALE' ? 'Nota' : 'PO Internal'}</Badge>
                <Badge tone={r.red ? 'danger' : 'warn'}>Tertunda ×{r.times}</Badge>
              </span>
            ),
          },
          { key: 'first', header: 'Pertama tertunda', render: (r) => <span className={r.red ? 'font-medium text-danger' : ''}>{r.firstOn} · {r.age === 0 ? 'hari ini' : `${r.age} hari`}</span> },
          { key: 'origin', header: 'Dari', render: (r) => r.origin },
          {
            key: 'to', header: 'Tujuan',
            render: (r) => (r.customerId ? <Link href={`/logistik/toko/${r.customerId}`} className="underline">{r.destination}</Link> : `${r.destination} (cabang)`),
          },
          {
            key: 'last', header: 'Terakhir',
            render: (r) => (
              <span className="text-sm">
                {r.lastTrip && <Link href={`/logistik/trip/${r.lastTrip.id}`} className="underline">{r.lastTrip.number}</Link>}
                {r.lastReason && <span className="block text-ink-muted">{r.lastReason}</span>}
              </span>
            ),
          },
          { key: 'status', header: 'Sekarang', render: (r) => STATUS_LABELS[r.status] },
          ...(canClose ? [{
            key: 'close', header: '',
            render: (r: PendingRow) => <Button size="sm" variant="secondary" onClick={() => { setTarget(r); setReason(''); setError(null); }}>Tutup</Button>,
          }] : []),
        ]}
      />
      {closed.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm text-ink-muted">20 tertunda terakhir yang ditutup</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {closed.map((c, n) => <li key={n}><b>{c.number}</b> · {c.on} {c.at} · {c.note}</li>)}
          </ul>
        </details>
      )}
      <Dialog
        open={!!target} onClose={() => setTarget(null)} title={target ? `Tutup tertunda ${target.number}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setTarget(null)}>Batal</Button><Button loading={busy} onClick={close}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="pending-close" label="Keterangan" hint="Contoh: toko minta dikirim Senin; sudah ditelepon.">
            <Textarea id="pending-close" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
