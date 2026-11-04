'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import type { NoteOption } from '../server/screens';

type Option = { id: number; name: string; detail?: string };

/**
 * Buat / Ubah trip Draft (spec L6 §3.2, LT1 §3.4): mobil, rute kirim (boleh kosong), surat jalan yang dicentang, supplier
 * belanja, driver, kenek.
 */
export function TripForm({ id, initial, vehicles, deliveryRoutes, shoppingRoutes, drivers, assistants, notes, notesTruncated }: {
  id: number | null;
  initial: { vehicleId: number; routeId: number | null; shoppingRouteIds: number[]; driverId: number | null; assistantIds: number[]; noteKeys: string[] } | null;
  vehicles: Option[]; deliveryRoutes: Option[]; shoppingRoutes: Option[]; drivers: Option[]; assistants: Option[];
  notes: NoteOption[]; notesTruncated: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [vehicleId, setVehicleId] = useState(String(initial?.vehicleId ?? ''));
  const [routeId, setRouteId] = useState(String(initial?.routeId ?? ''));
  const [shopping, setShopping] = useState<number[]>(initial?.shoppingRouteIds ?? []);
  const [driverId, setDriverId] = useState(String(initial?.driverId ?? ''));
  const [assistantIds, setAssistantIds] = useState<number[]>(initial?.assistantIds ?? []);
  const [picked, setPicked] = useState<string[]>(initial?.noteKeys ?? []);
  const [onlyRoute, setOnlyRoute] = useState(true);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: number[], value: number) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);
  const pickedSet = useMemo(() => new Set(picked), [picked]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((n) => (!onlyRoute || !routeId || n.routeId == null || String(n.routeId) === routeId)
      && (!q || n.number.toLowerCase().includes(q) || n.destination.toLowerCase().includes(q) || n.origin.toLowerCase().includes(q)))
      .sort((a, b) => Number(pickedSet.has(b.key)) - Number(pickedSet.has(a.key)));
  }, [notes, onlyRoute, routeId, query, pickedSet]);
  const chosen = notes.filter((n) => pickedSet.has(n.key));
  const destinations = new Set(chosen.map((n) => (n.kind === 'SALE' ? `C${n.destination}` : `B${n.destination}`))).size;
  const origins = [...new Set(chosen.map((n) => n.origin))];

  async function save() {
    setError(null);
    if (!vehicleId) return setError('Pilih mobil.');
    if (!routeId && !shopping.length) return setError('Isi rute kirim atau pilih minimal satu supplier belanja.');
    if (!routeId && picked.length) return setError('Trip yang membawa surat jalan wajib punya rute kirim.');
    if (!driverId) return setError('Pilih driver.');
    setBusy(true);
    const result = await postJson('/api/logistics', {
      action: id ? 'update' : 'create', tripId: id ?? undefined, vehicleId: Number(vehicleId), routeId: routeId ? Number(routeId) : null,
      shoppingRouteIds: shopping, driverId: Number(driverId), assistantIds: assistantIds.filter((a) => a !== Number(driverId)), noteKeys: picked,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(id ? 'Trip diubah.' : 'Trip dibuat. Awak sudah diberi tahu.', 'ok');
    router.push(`/logistik/trip/${id ?? Number(result.data?.id)}`);
    router.refresh();
  }

  return (
    <Card className="max-w-3xl space-y-4">
      {error && <Alert tone="danger">{error}</Alert>}
      <Field id="trip-vehicle" label="Mobil">
        <Select id="trip-vehicle" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)}>
          <option value="">Pilih mobil</option>
          {vehicles.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
        </Select>
      </Field>
      <Field id="trip-route" label="Rute kirim" hint="Kosongkan bila trip ini hanya belanja ke supplier.">
        <Select id="trip-route" value={routeId} onChange={(e) => setRouteId(e.target.value)}>
          <option value="">Tanpa kirim (belanja saja)</option>
          {deliveryRoutes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </Select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="flex items-center gap-2 text-sm font-medium">Surat jalan <NewBadge feature="fitur/surat-jalan-di-trip" /></legend>
        <p className="text-xs text-ink-muted">
          Centang nota / PO Internal yang dibawa trip ini. Satu toko = satu kunjungan. Barang dari cabang selain Gudang otomatis jadi langkah
          &quot;Ambil barang&quot; di HP driver. Boleh kosong selama masa peralihan.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nomor, toko, atau cabang" className="min-h-9 w-56 rounded-lg border border-line bg-surface px-3 text-sm" />
          {routeId && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={onlyRoute} onChange={(e) => setOnlyRoute(e.target.checked)} /> Hanya rute trip ini (dan yang belum berute)
            </label>
          )}
          <Button size="sm" variant="secondary" onClick={() => setPicked([...new Set([...picked, ...visible.map((n) => n.key)])])}>Centang semua yang tampil</Button>
          {picked.length > 0 && <Button size="sm" variant="ghost" onClick={() => setPicked([])}>Kosongkan</Button>}
        </div>
        {notesTruncated && <Alert tone="warn">Hanya 300 surat jalan terlama yang ditampilkan.</Alert>}
        <div className="max-h-96 divide-y divide-line overflow-y-auto rounded-lg border border-line">
          {!visible.length && <p className="p-3 text-sm text-ink-muted">{notes.length ? 'Tidak ada yang cocok dengan saringan.' : 'Tidak ada surat jalan yang menunggu dikirim.'}</p>}
          {visible.map((n) => (
            <label key={n.key} className="flex cursor-pointer items-start gap-2 p-2 text-sm hover:bg-canvas">
              <input type="checkbox" className="mt-1" checked={pickedSet.has(n.key)} onChange={() => setPicked(pickedSet.has(n.key) ? picked.filter((k) => k !== n.key) : [...picked, n.key])} />
              <span className="flex-1">
                <span className="font-medium">{n.destination}</span>
                {n.kind === 'TRANSFER' && <span className="text-ink-muted"> (cabang)</span>}
                <span className="block text-xs text-ink-muted">
                  {n.number} · {n.kind === 'SALE' ? 'Nota' : 'PO Internal'} · {n.on}{n.age ? ` (${n.age} hari)` : ''} · dari {n.origin}
                  {n.kind === 'SALE' && (n.route ? ` · rute ${n.route}` : ' · rute belum diisi')}
                </span>
              </span>
              {n.amount != null && <span className="tabular-nums">{rupiah(n.amount)}</span>}
            </label>
          ))}
        </div>
        <p className="text-sm">
          {picked.length ? <>{picked.length} surat jalan · {destinations} tujuan · dari {origins.join(', ')}</> : 'Belum ada surat jalan dipilih.'}
        </p>
      </fieldset>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Belanja ke supplier</legend>
        <p className="text-xs text-ink-muted">Boleh lebih dari satu. Tiap supplier yang selesai (foto nota) dihitung upah belanja, di atas ritase kirim.</p>
        <div className="flex flex-wrap gap-2">
          {shoppingRoutes.map((r) => (
            <label key={r.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <input type="checkbox" checked={shopping.includes(r.id)} onChange={() => setShopping(toggle(shopping, r.id))} /> {r.name}
            </label>
          ))}
          {!shoppingRoutes.length && <p className="text-sm text-ink-muted">Belum ada rute belanja aktif.</p>}
        </div>
      </fieldset>
      <Field id="trip-driver" label="Driver" hint="Hanya orang yang boleh menyetir.">
        <Select id="trip-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
          <option value="">Pilih driver</option>
          {drivers.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.detail}</option>)}
        </Select>
      </Field>
      <fieldset className="space-y-1.5">
        <legend className="text-sm font-medium">Kenek</legend>
        <p className="text-xs text-ink-muted">Boleh kosong. Hanya orang yang boleh jadi kenek.</p>
        <div className="flex flex-wrap gap-2">
          {assistants.filter((p) => String(p.id) !== driverId).map((p) => (
            <label key={p.id} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm">
              <input type="checkbox" checked={assistantIds.includes(p.id)} onChange={() => setAssistantIds(toggle(assistantIds, p.id))} /> {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex gap-2">
        <Button loading={busy} onClick={save}>{id ? 'Simpan perubahan' : 'Buat trip'}</Button>
        <Button variant="secondary" disabled={busy} onClick={() => router.back()}>Batal</Button>
      </div>
    </Card>
  );
}
