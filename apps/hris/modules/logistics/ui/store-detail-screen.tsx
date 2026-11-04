'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { STORE_NOTE_MAX } from '../rules/delivery-notes';
import { rupiah } from '../rules/rates';

type Props = {
  store: {
    customerId: number; code: string | null; name: string; phone: string | null; address: string | null; active: boolean;
    routeId: number | null; route: string | null; note: string | null;
  };
  routes: { id: number; name: string }[];
  notes: { id: number; number: string; origin: string; amount: number; on: string; age: number; status: string; pendingVoid: boolean; link: string | null }[];
  canManage: boolean;
};

/** Rincian toko (spec LT1 §12): data kasir hanya dibaca; rute bawaan + catatan pengiriman diubah di sini. */
export function StoreDetailScreen({ store, routes, notes, canManage }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [routeId, setRouteId] = useState(String(store.routeId ?? ''));
  const [note, setNote] = useState(store.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics/stores', {
      action: 'save_store', customerId: store.customerId, defaultRouteId: routeId ? Number(routeId) : null, deliveryNote: note,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return;
    }
    toast('Data pengiriman tersimpan.', 'ok');
    setOpen(false);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-2">
          <h2 className="font-semibold">Data dari kasir</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-3"><dt className="w-20 text-ink-muted">Kode</dt><dd>{store.code ?? '—'}</dd></div>
            <div className="flex gap-3"><dt className="w-20 text-ink-muted">HP</dt><dd>{store.phone ?? '—'}</dd></div>
            <div className="flex gap-3"><dt className="w-20 text-ink-muted">Alamat</dt><dd className="whitespace-pre-line">{store.address ?? '—'}</dd></div>
          </dl>
          {!store.active && <Badge tone="danger">Nonaktif di kasir</Badge>}
          <p className="text-xs text-ink-muted">Nama, HP, dan alamat diubah di kasir (Back Office › Pelanggan).</p>
        </Card>
        <Card className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Data pengiriman</h2>
            {canManage && (
              <Button size="sm" variant="secondary" onClick={() => {
                setError(null); setRouteId(String(store.routeId ?? '')); setNote(store.note ?? ''); setOpen(true);
              }}>Ubah</Button>
            )}
          </div>
          <dl className="space-y-1 text-sm">
            <div className="flex gap-3"><dt className="w-24 text-ink-muted">Rute bawaan</dt><dd>{store.route ?? <span className="text-ink-muted">belum diisi</span>}</dd></div>
            <div className="flex gap-3"><dt className="w-24 text-ink-muted">Catatan</dt><dd className="whitespace-pre-line">{store.note ?? <span className="text-ink-muted">—</span>}</dd></div>
          </dl>
        </Card>
      </div>

      <Card className="space-y-2">
        <h2 className="font-semibold">Nota truk Gudang terakhir</h2>
        {!notes.length ? <EmptyState title="Belum pernah dikirimi truk Gudang." /> : (
          <ul className="divide-y divide-line text-sm">
            {notes.map((n) => (
              <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="inline-flex flex-wrap items-center gap-1">
                  <span className="font-medium">{n.number}</span>
                  <span className="text-ink-muted">{n.on} · dari {n.origin}</span>
                  <Badge tone={n.status === 'Menunggu dikirim' ? 'warn' : 'danger'}>{n.pendingVoid ? 'Menunggu batal' : n.status}</Badge>
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="tabular-nums">{rupiah(n.amount)}</span>
                  {n.link && <a href={n.link} target="_blank" rel="noreferrer" className="text-sm underline">Back Office</a>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Dialog
        open={open} onClose={() => setOpen(false)} title={`Data pengiriman ${store.name}`}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <Field id="store-route" label="Rute bawaan">
            <Select id="store-route" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
              <option value="">Belum ditentukan</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </Select>
          </Field>
          <Field id="store-note" label={`Catatan pengiriman (paling banyak ${STORE_NOTE_MAX} huruf)`}>
            <Textarea id="store-note" rows={4} maxLength={STORE_NOTE_MAX} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Patokan, jam buka, bongkar di mana, dsb." />
          </Field>
        </div>
      </Dialog>
    </div>
  );
}
