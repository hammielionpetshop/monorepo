'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { RETURN_ITEMS_MAX, cleanReturnItems } from '../rules/returned-goods';
import type { PickupOutcome } from '../rules/return-pickups';
import type { ReturnPickupView } from '../server/return-pickups';
import { LiveCamera, photoForm, readLocation } from './capture';

const OUTCOME_TITLES: Record<PickupOutcome, string> = { PICKED: 'Retur diambil', NO_GOODS: 'Tidak ada barang', TOMORROW: 'Kirim Besok' };

/** Rincian satu tugas (alasan, perkiraan, riwayat singkat, barang yang diambil). */
function PickupBody({ p }: { p: ReturnPickupView }) {
  return (
    <div className="space-y-1 text-sm">
      <p>{p.reason}</p>
      {p.estimate && <p className="text-ink-muted">Perkiraan barang: {p.estimate}</p>}
      <p className="text-xs text-ink-muted">
        Pemilik barang {p.owner} · dibuat {p.createdBy} {p.createdOn}{p.tries ? ` · dicoba ×${p.tries}` : ''}
      </p>
      {p.items.length > 0 && (
        <ul className="pl-2 text-xs">{p.items.map((i, n) => <li key={n}>{i.name}: {i.quantity} {i.unit}</li>)}</ul>
      )}
      {p.events.length > 1 && (
        <details className="text-xs text-ink-muted">
          <summary className="cursor-pointer">Riwayat ({p.events.length})</summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {p.events.map((e, n) => (
              <li key={n}>
                {e.on} {e.at} · {e.label}{e.tripNumber ? ` (${e.tripNumber})` : ''} · {e.by}{e.note ? `: ${e.note}` : ''}
                {e.photoUrl && <> · <a className="underline" href={e.photoUrl} target="_blank" rel="noreferrer">foto</a></>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * Bagian Jemput retur di rincian trip dan Trip Saya (A2). `onAction` = awak saat trip berjalan; `onRelease` = kantor.
 */
export function TripReturnPickups({ tripId, returns, onAction, onRelease }: {
  tripId: number; returns: ReturnPickupView[]; onAction?: (p: ReturnPickupView, outcome: PickupOutcome) => void;
  onRelease?: (p: ReturnPickupView) => void;
}) {
  if (!returns.length) return null;
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-2 text-sm font-medium">Jemput retur <NewBadge feature="fitur/jemput-retur" /></p>
      <ul className="space-y-2">
        {returns.map((p) => {
          const open = p.status === 'ON_TRIP' && p.tripId === tripId;
          return (
            <li key={p.id} className="space-y-2 rounded-lg border border-line p-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-medium">{p.store}</p>
                  {p.address && <p className="text-xs text-ink-muted">{p.address}{p.phone ? ` · ${p.phone}` : ''}</p>}
                </div>
                <Badge tone={open ? 'warn' : p.tone}>{open ? 'Belum dikerjakan' : p.statusLabel}</Badge>
              </div>
              <PickupBody p={p} />
              {open && onAction && (
                <div className="grid grid-cols-3 gap-1">
                  <Button size="sm" className="min-h-11" onClick={() => onAction(p, 'PICKED')}>Diambil</Button>
                  <Button size="sm" className="min-h-11" variant="secondary" onClick={() => onAction(p, 'NO_GOODS')}>Tidak ada barang</Button>
                  <Button size="sm" className="min-h-11" variant="secondary" onClick={() => onAction(p, 'TOMORROW')}>Kirim Besok</Button>
                </div>
              )}
              {open && onRelease && <Button size="sm" variant="ghost" onClick={() => onRelease(p)}>Lepas dari trip</Button>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Langkah jemput di HP awak: Diambil = rincian barang + foto (jadi laporan Retur → Barang Kembali), Tidak ada barang /
 * Kirim Besok = alasan + foto. Kamera langsung; lokasi dicatat bila terbaca.
 */
export function PickupFlow({ tripId, pickup, outcome, onDone }: {
  tripId: number; pickup: ReturnPickupView; outcome: PickupOutcome; onDone: (saved: boolean) => void;
}) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [items, setItems] = useState([{ name: '', quantity: '', unit: '' }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const picked = outcome === 'PICKED';
  const ready = picked ? cleanReturnItems(items).ok : note.trim().length >= 5;
  const setItem = (index: number, field: 'name' | 'quantity' | 'unit', value: string) =>
    setItems((list) => list.map((item, n) => (n === index ? { ...item, [field]: value } : item)));

  async function send() {
    if (!photo) return;
    if (picked) {
      const check = cleanReturnItems(items);
      if (!check.ok) return setError(check.error);
    }
    setBusy(true);
    setError(null);
    const point = await readLocation();
    const result = await postJson('/api/logistics/upload', photoForm({
      action: 'return_pickup', tripId, pickupId: pickup.id, outcome, note, items: picked ? JSON.stringify(items) : null,
      latitude: point?.latitude, longitude: point?.longitude, accuracy: point?.accuracy,
    }, photo));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`${pickup.store}: ${OUTCOME_TITLES[outcome]} tercatat.`, 'ok');
    onDone(true);
  }

  return (
    <Card className="mx-auto max-w-md space-y-3">
      <div>
        <p className="text-sm text-ink-muted">Jemput retur · {pickup.store}</p>
        <h2 className="font-semibold">{OUTCOME_TITLES[outcome]}</h2>
      </div>
      <p className="text-sm">{pickup.reason}{pickup.estimate ? ` · perkiraan: ${pickup.estimate}` : ''}</p>
      {error && <Alert tone="danger">{error}</Alert>}
      {picked && (
        <div className="space-y-2">
          <p className="text-sm font-medium">Barang retur yang diambil (milik {pickup.owner})</p>
          {items.map((item, n) => (
            <div key={n} className="grid grid-cols-[1fr_4.5rem_4.5rem] gap-1">
              <Input aria-label={`Nama barang ${n + 1}`} placeholder="Nama barang" value={item.name} maxLength={120} onChange={(e) => setItem(n, 'name', e.target.value)} />
              <Input aria-label={`Jumlah ${n + 1}`} placeholder="Jml" inputMode="decimal" value={item.quantity} maxLength={10} onChange={(e) => setItem(n, 'quantity', e.target.value)} />
              <Input aria-label={`Satuan ${n + 1}`} placeholder="pcs" value={item.unit} maxLength={20} onChange={(e) => setItem(n, 'unit', e.target.value)} />
            </div>
          ))}
          <div className="flex gap-2">
            {items.length < RETURN_ITEMS_MAX && (
              <Button size="sm" variant="secondary" onClick={() => setItems((list) => [...list, { name: '', quantity: '', unit: '' }])}>+ Barang</Button>
            )}
            {items.length > 1 && <Button size="sm" variant="ghost" onClick={() => setItems((list) => list.slice(0, -1))}>Hapus baris terakhir</Button>}
          </div>
        </div>
      )}
      <Field id="pickup-note" label={picked ? 'Catatan (boleh kosong)' : outcome === 'TOMORROW' ? 'Kenapa belum bisa diambil? (wajib)' : 'Kenapa tidak ada barang? (wajib)'}>
        <Textarea id="pickup-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
          placeholder={picked ? 'Contoh: 1 dus basah' : outcome === 'TOMORROW' ? 'Contoh: toko tutup, pemilik tidak ada' : 'Contoh: toko batal retur, barang sudah dibuang'} />
      </Field>
      {photo ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={URL.createObjectURL(photo)} alt="Foto jemput retur" className="w-full rounded-lg" />
          <div className="flex gap-2">
            <Button block className="min-h-12" loading={busy} disabled={!ready} onClick={send}>Simpan</Button>
            <Button variant="secondary" className="min-h-12" disabled={busy} onClick={() => setPhoto(null)}>Ulangi</Button>
          </div>
          {!ready && <p className="text-xs text-ink-muted">{picked ? 'Isi nama, jumlah, dan satuan barang.' : 'Tulis alasannya, paling sedikit 5 huruf.'}</p>}
        </>
      ) : <LiveCamera onPhoto={setPhoto} onError={setError} label={picked ? 'Foto barang retur' : 'Foto keadaan toko'} />}
      <Button variant="ghost" block disabled={busy} onClick={() => onDone(false)}>Batal</Button>
    </Card>
  );
}

/** Isian alasan (Batalkan / Lepas dari trip), paling sedikit 5 huruf. */
export function ReasonDialog({ open, title, busy, onClose, onSubmit }: {
  open: boolean; title: string; busy: boolean; onClose: () => void; onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Dialog open={open} onClose={() => { setReason(''); onClose(); }} title={title} footer={(
      <>
        <Button variant="secondary" disabled={busy} onClick={() => { setReason(''); onClose(); }}>Batal</Button>
        <Button loading={busy} disabled={reason.trim().length < 5} onClick={() => { onSubmit(reason); setReason(''); }}>Simpan</Button>
      </>
    )}>
      <Field id="reason-dialog" label="Alasan (wajib, paling sedikit 5 huruf)">
        <Textarea id="reason-dialog" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
    </Dialog>
  );
}

type StoreHit = { id: number; code: string | null; name: string; address: string | null; openTask: boolean };

/** Form Buat tugas jemput: cari toko, alasan, perkiraan barang, pemilik barang. */
function CreatePickup({ branches, homeBranchId }: { branches: { id: number; name: string }[]; homeBranchId: number | null }) {
  const router = useRouter();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<StoreHit[] | null>(null);
  const [store, setStore] = useState<StoreHit | null>(null);
  const [reason, setReason] = useState('');
  const [estimate, setEstimate] = useState('');
  const [owner, setOwner] = useState(String(homeBranchId ?? ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function search() {
    setError(null);
    if (query.trim().length < 2) return setError('Ketik paling sedikit 2 huruf nama / kode / HP toko.');
    const res = await fetch(`/api/logistics/return-pickups?q=${encodeURIComponent(query.trim())}`);
    const body = await res.json().catch(() => null);
    if (!res.ok) return setError(body?.error ?? 'Gagal mencari toko.');
    setHits(body.stores ?? []);
  }

  async function save() {
    if (!store) return setError('Pilih toko.');
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', {
      action: 'create_return_pickup', customerId: store.id, ownerBranchId: owner ? Number(owner) : null, reason, estimate: estimate || null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Tugas jemput retur ${store.name} dibuat. Kepala Gudang diberi tahu.`, 'ok');
    setStore(null); setHits(null); setQuery(''); setReason(''); setEstimate('');
    router.refresh();
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Buat tugas jemput retur</h2>
      {error && <Alert tone="danger">{error}</Alert>}
      {store ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
          <span><b>{store.name}</b>{store.address ? <span className="block text-xs text-ink-muted">{store.address}</span> : null}</span>
          <Button size="sm" variant="ghost" onClick={() => setStore(null)}>Ganti</Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input aria-label="Cari toko" placeholder="Nama, kode, atau HP toko" value={query} onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void search(); }} />
            <Button variant="secondary" onClick={search}>Cari</Button>
          </div>
          {hits && !hits.length && <p className="text-sm text-ink-muted">Toko tidak ditemukan.</p>}
          {hits && hits.length > 0 && (
            <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-lg border border-line text-sm">
              {hits.map((h) => (
                <li key={h.id}>
                  <button type="button" disabled={h.openTask} className="w-full p-2 text-left hover:bg-canvas disabled:opacity-60" onClick={() => setStore(h)}>
                    <b>{h.name}</b>{h.code ? ` (${h.code})` : ''}{h.openTask ? ' · sudah ada tugas jemput terbuka' : ''}
                    {h.address && <span className="block text-xs text-ink-muted">{h.address}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Field id="pickup-reason" label="Alasan retur (wajib)" hint="Contoh: toko lapor 3 sak pakan kedaluwarsa, minta ditukar.">
        <Textarea id="pickup-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} />
      </Field>
      <Field id="pickup-estimate" label="Perkiraan barang (boleh kosong)">
        <Input id="pickup-estimate" value={estimate} onChange={(e) => setEstimate(e.target.value)} maxLength={300} placeholder="Contoh: ± 3 sak Royal 10 kg" />
      </Field>
      <Field id="pickup-owner" label="Barang milik cabang" hint="Bawaan Gudang. Barang milik cabang lain diterima Gudang dulu, lalu diantar ke pemiliknya.">
        <Select id="pickup-owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
          <option value="">Pilih cabang</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </Select>
      </Field>
      <Button loading={busy} disabled={!store || reason.trim().length < 5 || !owner} onClick={save}>Simpan tugas</Button>
    </Card>
  );
}

/** Halaman Logistik › Jemput Retur (A2): buat tugas, masukkan ke trip, lepas, batalkan; riwayat 30 terakhir. */
export function ReturnPickupsScreen({ waiting, onTrip, done, trips, branches, homeBranchId, canCreate, canAssign }: {
  waiting: ReturnPickupView[]; onTrip: ReturnPickupView[]; done: ReturnPickupView[]; trips: { id: number; label: string }[];
  branches: { id: number; name: string }[]; homeBranchId: number | null; canCreate: boolean; canAssign: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: number, body: Record<string, unknown>, done: string) {
    setBusy(id);
    setError(null);
    const result = await postJson('/api/logistics', body);
    setBusy(null);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(done, 'ok');
    router.refresh();
  }

  const [asking, setAsking] = useState<{ id: number; action: string; title: string; done: string } | null>(null);
  function withReason(id: number, action: string, title: string, done: string) {
    setAsking({ id, action, title, done });
  }

  return (
    <div className="space-y-4">
      {canCreate && <CreatePickup branches={branches} homeBranchId={homeBranchId} />}
      {error && <Alert tone="danger">{error}</Alert>}
      <ReasonDialog open={!!asking} title={asking?.title ?? ''} busy={busy != null} onClose={() => setAsking(null)}
        onSubmit={(reason) => { if (asking) void act(asking.id, { action: asking.action, id: asking.id, reason }, asking.done).then(() => setAsking(null)); }} />
      <Card className="space-y-2">
        <h2 className="font-semibold">Menunggu ({waiting.length})</h2>
        {!waiting.length && <EmptyState title="Tidak ada tugas menunggu">Tugas baru muncul di sini sampai dimasukkan ke trip.</EmptyState>}
        <ul className="space-y-2">
          {waiting.map((p) => (
            <li key={p.id} className={`space-y-2 rounded-lg border p-2 ${p.red ? 'border-danger-fg' : 'border-line'}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{p.store}</p>
                <Badge tone={p.red ? 'danger' : 'warn'}>{p.age ? `${p.age} hari` : 'Hari ini'}</Badge>
              </div>
              <PickupBody p={p} />
              <div className="flex flex-wrap items-center gap-2">
                {canAssign && (
                  <>
                    <Select aria-label="Pilih trip" value={target[p.id] ?? ''} onChange={(e) => setTarget({ ...target, [p.id]: e.target.value })} className="max-w-xs">
                      <option value="">Pilih trip</option>
                      {trips.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </Select>
                    <Button size="sm" loading={busy === p.id} disabled={!target[p.id]}
                      onClick={() => act(p.id, { action: 'assign_return_pickup', id: p.id, tripId: Number(target[p.id]) }, `${p.store} masuk trip.`)}>
                      Masukkan ke trip
                    </Button>
                  </>
                )}
                {(canAssign || p.mine) && (
                  <Button size="sm" variant="ghost" disabled={busy === p.id}
                    onClick={() => withReason(p.id, 'cancel_return_pickup', `Batalkan tugas jemput ${p.store}`, 'Tugas dibatalkan.')}>
                    Batalkan
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
        {canAssign && !trips.length && waiting.length > 0 && <p className="text-xs text-ink-muted">Belum ada trip Draft / berjalan berute kirim. Buat trip dulu; tugas bisa dicentang di form trip.</p>}
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Di trip ({onTrip.length})</h2>
        {!onTrip.length && <p className="text-sm text-ink-muted">Tidak ada.</p>}
        <ul className="space-y-2">
          {onTrip.map((p) => (
            <li key={p.id} className="space-y-2 rounded-lg border border-line p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{p.store}</p>
                {p.tripId && <a className="text-sm underline" href={`/logistik/trip/${p.tripId}`}>{p.tripNumber ?? 'Trip'}</a>}
              </div>
              <PickupBody p={p} />
              {canAssign && (
                <Button size="sm" variant="ghost" disabled={busy === p.id}
                  onClick={() => withReason(p.id, 'release_return_pickup', `Lepas ${p.store} dari trip`, 'Tugas kembali Menunggu.')}>
                  Lepas dari trip
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <Card className="space-y-2">
        <h2 className="font-semibold">Selesai (30 terakhir)</h2>
        {!done.length && <p className="text-sm text-ink-muted">Belum ada.</p>}
        <ul className="space-y-2">
          {done.map((p) => (
            <li key={p.id} className="space-y-1 rounded-lg border border-line p-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-medium">{p.store}</p>
                <Badge tone={p.tone}>{p.statusLabel}</Badge>
              </div>
              <PickupBody p={p} />
              {p.status === 'PICKED' && <p className="text-xs text-ink-muted">Barang diterima di Barang Kembali; keputusan Retur BO di Laporan Toko.</p>}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
