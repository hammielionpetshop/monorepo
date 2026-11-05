'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import type { FollowupRow } from '../server/driver-trip';

type Recent = FollowupRow & { fuelState: string | null; conditionState: string | null };

const tripLink = (r: FollowupRow) => <Link href={`/logistik/trip/${r.tripId}`} className="underline">{r.tripNumber}</Link>;

/** Bensin & Mobil (spec LT1 §13.3 butir 6): keadaan mobil dan Laporan Pulang driver. Bensin di FuelPanel (spec LT1 §17.1). */
export function FollowupScreen({ condition, recent }: { condition: FollowupRow[]; recent: Recent[] }) {
  const router = useRouter();
  const toast = useToast();
  const [closing, setClosing] = useState<FollowupRow | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>, message: string) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(message, 'ok');
    setClosing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && !closing && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-2">
        <h2 className="font-semibold">Mobil perlu perhatian <span className="tabular-nums text-ink-muted">{condition.length}</span></h2>
        {!condition.length ? <EmptyState title="Semua mobil baik" /> : (
          <ul className="space-y-2">
            {condition.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                <span>
                  <span className="font-medium">{r.vehicle}</span>: {r.conditionNote}
                  {r.photoUrl && <> · <a href={r.photoUrl} target="_blank" rel="noreferrer" className="underline">Foto</a></>}
                  <span className="block text-ink-muted">{r.driver}, {r.sentOn} {r.sentAt} · {tripLink(r)}</span>
                </span>
                <Button size="sm" variant="secondary" onClick={() => { setClosing(r); setNote(''); setError(null); }}>Selesai</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Laporan Pulang terakhir</h2>
        <DataList
          rows={recent} rowKey={(r) => String(r.id)} empty="Belum ada Laporan Pulang."
          columns={[
            { key: 'when', header: 'Waktu', primary: true, render: (r) => <span>{r.sentOn} {r.sentAt} · {tripLink(r)}</span> },
            { key: 'vehicle', header: 'Mobil', render: (r) => r.vehicle },
            { key: 'driver', header: 'Driver', render: (r) => r.driver },
            {
              key: 'condition', header: 'Keadaan',
              render: (r) => (r.condition === 'GOOD' ? <Badge tone="ok">Baik</Badge>
                : <span><Badge tone="warn">Perlu perhatian</Badge> {r.conditionNote} <span className="text-ink-muted">({r.conditionState})</span></span>),
            },
            { key: 'fuel', header: 'Bensin', render: (r) => (r.fuelEstimate ? <span>± {rupiah(r.fuelEstimate)} <span className="text-ink-muted">({r.fuelState})</span></span> : 'Tidak perlu') },
            { key: 'problem', header: 'Masalah', render: (r) => r.problemNote ?? '—' },
          ]}
        />
      </Card>
      <Dialog
        open={!!closing} onClose={() => setClosing(null)} title={closing ? `Selesai: ${closing.vehicle}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setClosing(null)}>Batal</Button>
          <Button loading={busy} onClick={() => closing && send({ action: 'close_condition', reportId: closing.id, note }, `${closing.vehicle} ditandai selesai.`)}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {closing && <p>{closing.conditionNote}</p>}
          <Field id="close-note" label="Catatan (boleh kosong)" hint="Contoh: sudah diservis di bengkel X.">
            <Textarea id="close-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
