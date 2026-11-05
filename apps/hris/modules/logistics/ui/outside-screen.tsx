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
import type { OutsideRow } from '../server/outside-points';

/** Di Luar Titik (spec LT1 §17.1 butir 9): Wajar / Tidak wajar, alasan wajib untuk Tidak wajar. Tanpa potongan otomatis. */
export function OutsideScreen({ tab, radius, rows }: { tab: 'WAITING' | 'DONE'; radius: number; rows: OutsideRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [notOk, setNotOk] = useState<OutsideRow | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(row: OutsideRow, verdict: 'OK' | 'NOT_OK') {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', { action: 'review_outside', kind: row.kind, targetId: row.id, verdict, reason: verdict === 'NOT_OK' ? reason : null });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(verdict === 'OK' ? 'Ditandai Wajar.' : 'Ditandai Tidak wajar; awak dan Pemilik/GM diberi tahu.', 'ok');
    setNotOk(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 text-sm">
        <Link href="/logistik/di-luar-titik" className={tab === 'WAITING' ? 'font-semibold underline' : 'underline'}>Belum ditinjau</Link>
        <Link href="/logistik/di-luar-titik?tab=DONE" className={tab === 'DONE' ? 'font-semibold underline' : 'underline'}>Sudah ditinjau (30 hari)</Link>
      </div>
      <p className="text-sm text-ink-muted">Terkirim lebih dari {radius} m dari titik toko yang disetujui. Kiriman yang Anda bawa sendiri ditinjau orang lain.</p>
      {error && !notOk && <Alert tone="danger">{error}</Alert>}
      <DataList
        rows={rows} rowKey={(r) => `${r.kind}-${r.id}`} empty={tab === 'WAITING' ? 'Tidak ada kiriman di luar titik yang menunggu.' : 'Belum ada yang ditinjau.'}
        columns={[
          { key: 'when', header: 'Terkirim', primary: true, render: (r) => <span>{r.on} {r.at}{r.red && <> <Badge tone="danger">{r.days} hari</Badge></>}</span> },
          { key: 'store', header: 'Toko', render: (r) => r.store },
          { key: 'trip', header: 'Perjalanan', render: (r) => <Link href={r.tripHref} className="underline">{r.kind === 'TRUCK' ? 'Trip' : 'Antar sendiri'} {r.tripNumber}</Link> },
          { key: 'crew', header: 'Awak / PJ', render: (r) => r.crew },
          { key: 'distance', header: 'Jarak', render: (r) => <span className="tabular-nums">{r.distanceM} m</span> },
          {
            key: 'review', header: tab === 'WAITING' ? '' : 'Hasil',
            render: (r) => (r.verdict
              ? <span><Badge tone={r.verdict === 'OK' ? 'ok' : 'danger'}>{r.verdict === 'OK' ? 'Wajar' : 'Tidak wajar'}</Badge> {r.reason}
                <span className="block text-ink-muted">{r.reviewedBy ?? '-'}, {r.reviewedOn}</span></span>
              : r.canReview
                ? <span className="flex gap-2">
                    <Button size="sm" loading={busy} onClick={() => review(r, 'OK')}>Wajar</Button>
                    <Button size="sm" variant="secondary" onClick={() => { setNotOk(r); setReason(''); setError(null); }}>Tidak wajar</Button>
                  </span>
                : <span className="text-ink-muted">Ditinjau orang lain</span>),
          },
        ]}
      />
      <Dialog
        open={!!notOk} onClose={() => setNotOk(null)} title={notOk ? `Tidak wajar: ${notOk.store}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setNotOk(null)}>Batal</Button>
          <Button loading={busy} onClick={() => notOk && review(notOk, 'NOT_OK')}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="outside-reason" label="Alasan" hint="Paling sedikit 5 huruf. Awak / PJ dan Pemilik/GM diberi tahu; tidak ada potongan otomatis.">
            <Textarea id="outside-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
