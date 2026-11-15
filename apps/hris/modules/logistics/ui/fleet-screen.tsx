'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Props = {
  vehicles: { id: number; name: string; plate: string; active: boolean }[];
  routes: { id: number; name: string; kind: 'DELIVERY' | 'SHOPPING'; kindLabel: string; active: boolean }[];
  canEdit: boolean; canOwner: boolean;
  garage: { branchId: number | null; name: string | null; hasPoint: boolean; radiusM: number | null };
  branches: { id: number; name: string }[];
  fence: { until: string; untilDate: string; reason: string } | null;
};

type Edit = { kind: 'vehicle'; id: number | null; name: string; plate: string } | { kind: 'route'; id: number | null; name: string; routeKind: 'DELIVERY' | 'SHOPPING' } | null;

/** Mobil & Rute (spec L6 §3.1, §4) + titik garasi + pagar uji (LOG-104). */
export function FleetScreen({ vehicles, routes, canEdit, canOwner, garage, branches, fence }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<Edit>(null);
  const [garageId, setGarageId] = useState(String(garage.branchId ?? ''));
  const [fenceHours, setFenceHours] = useState('4');
  const [fenceReason, setFenceReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(done, 'ok');
    router.refresh();
    return true;
  }

  async function saveEdit() {
    if (!edit) return;
    const ok = edit.kind === 'vehicle'
      ? await send({ action: 'save_vehicle', id: edit.id, name: edit.name, plate: edit.plate }, 'Mobil tersimpan.')
      : await send({ action: 'save_route', id: edit.id, name: edit.name, kind: edit.routeKind }, 'Rute tersimpan.');
    if (ok) setEdit(null);
  }

  const routeGroups: { kind: 'DELIVERY' | 'SHOPPING'; title: string }[] = [
    { kind: 'DELIVERY', title: 'Rute kirim' }, { kind: 'SHOPPING', title: 'Rute belanja (supplier)' },
  ];

  return (
    <div className="space-y-4">
      {error && !edit && <Alert tone="danger">{error}</Alert>}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Mobil</h2>
            {canEdit && <Button size="sm" onClick={() => { setError(null); setEdit({ kind: 'vehicle', id: null, name: '', plate: '' }); }}>Tambah mobil</Button>}
          </div>
          <ul className="divide-y divide-line text-sm">
            {vehicles.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className={v.active ? '' : 'text-ink-muted'}>{v.name} ({v.plate}) {!v.active && <Badge tone="danger">Nonaktif</Badge>}</span>
                {canEdit && (
                  <span className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => { setError(null); setEdit({ kind: 'vehicle', id: v.id, name: v.name, plate: v.plate }); }}>Ubah</Button>
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: 'set_active', target: 'vehicle', id: v.id, active: !v.active }, v.active ? 'Mobil dinonaktifkan.' : 'Mobil aktif lagi.')}>
                      {v.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </Button>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Card>
        {routeGroups.map((g) => (
          <Card key={g.kind} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">{g.title}</h2>
              {canEdit && <Button size="sm" onClick={() => { setError(null); setEdit({ kind: 'route', id: null, name: '', routeKind: g.kind }); }}>Tambah</Button>}
            </div>
            <ul className="divide-y divide-line text-sm">
              {routes.filter((r) => r.kind === g.kind).map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className={r.active ? '' : 'text-ink-muted'}>{r.name} {!r.active && <Badge tone="danger">Nonaktif</Badge>}</span>
                  {canEdit && (
                    <span className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setError(null); setEdit({ kind: 'route', id: r.id, name: r.name, routeKind: r.kind }); }}>Ubah</Button>
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => send({ action: 'set_active', target: 'route', id: r.id, active: !r.active }, r.active ? 'Rute dinonaktifkan.' : 'Rute aktif lagi.')}>
                        {r.active ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        ))}
        <Card className="space-y-3">
          <h2 className="flex items-center gap-2 font-semibold">Titik garasi <NewBadge feature="fitur/titik-garasi" /></h2>
          <p className="text-sm">
            Sampai Garasi hanya bisa di titik cabang <b>{garage.name ?? 'belum diatur'}</b>
            {garage.radiusM != null ? `, radius ${garage.radiusM} m (radius absen cabang itu).` : '.'}
          </p>
          {garage.name && !garage.hasPoint && <Alert tone="warn">Titik cabang {garage.name} belum diisi di Lokasi & QR Cabang, jadi Sampai Garasi ditolak.</Alert>}
          {canOwner && (
            <div className="flex flex-wrap items-end gap-2">
              <Field id="garage-branch" label="Cabang titik garasi">
                <Select id="garage-branch" value={garageId} onChange={(e) => setGarageId(e.target.value)}>
                  <option value="">Pilih cabang</option>
                  {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                </Select>
              </Field>
              <Button size="sm" disabled={busy || !garageId} onClick={() => send({ action: 'set_garage', branchId: Number(garageId) }, 'Titik garasi tersimpan.')}>Simpan</Button>
            </div>
          )}
        </Card>
        {canOwner && (
          <Card className="space-y-3">
            <h2 className="font-semibold">Pagar uji</h2>
            {fence ? (
              <>
                <Alert tone="warn">Pemeriksaan titik garasi MATI sampai {fence.untilDate} {fence.until}. Alasan: {fence.reason}</Alert>
                <Button size="sm" disabled={busy} onClick={() => send({ action: 'fence_on' }, 'Pemeriksaan titik garasi menyala lagi.')}>Nyalakan lagi sekarang</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-ink-muted">Untuk uji coba dari luar gudang. Paling lama 24 jam, menyala lagi sendiri; Sampai Garasi selama mati bertanda.</p>
                <Field id="fence-hours" label="Lama mati (jam)"><Input id="fence-hours" type="number" min={1} max={24} value={fenceHours} onChange={(e) => setFenceHours(e.target.value)} /></Field>
                <Field id="fence-reason" label="Alasan"><Textarea id="fence-reason" value={fenceReason} onChange={(e) => setFenceReason(e.target.value)} /></Field>
                <Button size="sm" variant="danger" disabled={busy} onClick={() => send({ action: 'fence_off', hours: Number(fenceHours), reason: fenceReason }, 'Pemeriksaan titik garasi dimatikan.')}>Matikan sementara</Button>
              </>
            )}
          </Card>
        )}
      </div>

      <Dialog
        open={!!edit} onClose={() => setEdit(null)} title={edit?.kind === 'vehicle' ? (edit.id ? 'Ubah mobil' : 'Tambah mobil') : edit?.id ? 'Ubah rute' : 'Tambah rute'}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setEdit(null)}>Batal</Button><Button loading={busy} onClick={saveEdit}>Simpan</Button></>}
      >
        {edit && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field id="edit-name" label={edit.kind === 'vehicle' ? 'Nama mobil' : edit.routeKind === 'SHOPPING' ? 'Nama supplier' : 'Nama rute'}>
              <Input id="edit-name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            {edit.kind === 'vehicle' ? (
              <Field id="edit-plate" label="Plat nomor"><Input id="edit-plate" value={edit.plate} onChange={(e) => setEdit({ ...edit, plate: e.target.value })} /></Field>
            ) : (
              <Field id="edit-kind" label="Jenis" hint="Tidak bisa diubah sesudah rute pernah dipakai trip.">
                <Select id="edit-kind" value={edit.routeKind} onChange={(e) => setEdit({ ...edit, routeKind: e.target.value as 'DELIVERY' | 'SHOPPING' })}>
                  <option value="DELIVERY">Kirim</option>
                  <option value="SHOPPING">Belanja supplier</option>
                </Select>
              </Field>
            )}
          </div>
        )}
      </Dialog>
    </div>
  );
}
