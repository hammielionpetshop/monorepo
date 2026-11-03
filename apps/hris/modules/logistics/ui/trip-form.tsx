'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Select } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Option = { id: number; name: string; detail?: string };

/** Buat / Ubah trip Draft (spec L6 §3.2): mobil, rute kirim (boleh kosong), supplier belanja, driver, kenek. */
export function TripForm({ id, initial, vehicles, deliveryRoutes, shoppingRoutes, drivers, assistants }: {
  id: number | null;
  initial: { vehicleId: number; routeId: number | null; shoppingRouteIds: number[]; driverId: number | null; assistantIds: number[] } | null;
  vehicles: Option[]; deliveryRoutes: Option[]; shoppingRoutes: Option[]; drivers: Option[]; assistants: Option[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [vehicleId, setVehicleId] = useState(String(initial?.vehicleId ?? ''));
  const [routeId, setRouteId] = useState(String(initial?.routeId ?? ''));
  const [shopping, setShopping] = useState<number[]>(initial?.shoppingRouteIds ?? []);
  const [driverId, setDriverId] = useState(String(initial?.driverId ?? ''));
  const [assistantIds, setAssistantIds] = useState<number[]>(initial?.assistantIds ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (list: number[], value: number) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value]);

  async function save() {
    setError(null);
    if (!vehicleId) return setError('Pilih mobil.');
    if (!routeId && !shopping.length) return setError('Isi rute kirim atau pilih minimal satu supplier belanja.');
    if (!driverId) return setError('Pilih driver.');
    setBusy(true);
    const result = await postJson('/api/logistics', {
      action: id ? 'update' : 'create', tripId: id ?? undefined, vehicleId: Number(vehicleId), routeId: routeId ? Number(routeId) : null,
      shoppingRouteIds: shopping, driverId: Number(driverId), assistantIds: assistantIds.filter((a) => a !== Number(driverId)),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(id ? 'Trip diubah.' : 'Trip dibuat. Awak sudah diberi tahu.', 'ok');
    router.push(`/logistik/trip/${id ?? Number(result.data?.id)}`);
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
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
