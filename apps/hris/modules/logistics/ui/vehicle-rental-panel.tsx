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
import type { VehicleRentalSettings } from '../server/vehicle-rental';

const rp = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;

type Props = VehicleRentalSettings & { vehicles: { id: number; name: string; plate: string; active: boolean }[]; today: string };

type Edit =
  | { kind: 'ownership'; vehicleId: number; ownership: 'OWNED' | 'RENTED'; ownerName: string; ownerNote: string }
  | { kind: 'rate'; vehicleId: number; effectiveFrom: string; amount: string }
  | { kind: 'fix'; id: number; amount: string; reason: string }
  | { kind: 'cancel'; id: number; reason: string }
  | null;

/** Kepemilikan & tarif sewa per ritase di Mobil & Rute (F2-5b, spec F2-5 §3.1). Pengatur = pengatur Tarif Ritase. */
export function VehicleRentalPanel({ vehicles, rental, canManageRental, today }: Props) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<Edit>(null);
  const [history, setHistory] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const byId = new Map(rental.map((r) => [r.vehicleId, r]));

  async function save() {
    if (!edit) return;
    const form = new FormData();
    if (edit.kind === 'ownership') {
      form.set('action', 'set_ownership');
      form.set('vehicleId', String(edit.vehicleId));
      form.set('ownership', edit.ownership);
      form.set('ownerName', edit.ownerName);
      form.set('ownerNote', edit.ownerNote);
    } else if (edit.kind === 'rate') {
      form.set('action', 'create_rate');
      form.set('vehicleId', String(edit.vehicleId));
      form.set('effectiveFrom', edit.effectiveFrom);
      form.set('amount', edit.amount);
    } else {
      form.set('action', edit.kind === 'fix' ? 'fix_rate' : 'cancel_rate');
      form.set('id', String(edit.id));
      form.set('reason', edit.reason);
      if (edit.kind === 'fix') form.set('amount', edit.amount);
    }
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics/vehicle-rental', form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return;
    }
    toast(typeof result.data?.message === 'string' ? result.data.message : 'Tersimpan.', 'ok');
    setEdit(null);
    router.refresh();
  }

  const title = !edit ? '' : edit.kind === 'ownership' ? 'Kepemilikan mobil' : edit.kind === 'rate' ? 'Tarif sewa baru' : edit.kind === 'fix' ? 'Betulkan salah ketik' : 'Batalkan tarif sewa';

  return (
    <Card className="space-y-3">
      <h2 className="flex items-center gap-2 font-semibold">Kepemilikan & tarif sewa <NewBadge feature="fitur/sewa-mobil-pengaturan" /></h2>
      <p className="text-sm text-ink-muted">Mobil sewa dibayar per ritase: 1 trip Selesai = 1 ritase. Rekap dan bayar di Logistik › Sewa Mobil.</p>
      <ul className="divide-y divide-line text-sm">
        {vehicles.map((v) => {
          const r = byId.get(v.id);
          if (!r) return null;
          return (
            <li key={v.id} className="space-y-2 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={v.active ? '' : 'text-ink-muted'}>
                  {v.name} ({v.plate}) <Badge tone={r.ownership === 'RENTED' ? 'warn' : 'info'}>{r.ownershipLabel}</Badge>
                  {r.ownership === 'RENTED' && (
                    <span className="block text-ink-muted">
                      Pemilik {r.ownerName}{r.ownerNote ? ` · ${r.ownerNote}` : ''} · {r.current ? `${rp(r.current.amount)} per ritase` : 'belum bertarif'}
                    </span>
                  )}
                </span>
                <span className="flex flex-wrap gap-1">
                  {r.history.length > 0 && <Button size="sm" variant="ghost" onClick={() => setHistory(history === v.id ? null : v.id)}>Riwayat tarif</Button>}
                  {canManageRental && (
                    <Button size="sm" variant="ghost" onClick={() => { setError(null); setEdit({ kind: 'ownership', vehicleId: v.id, ownership: r.ownership, ownerName: r.ownerName ?? '', ownerNote: r.ownerNote ?? '' }); }}>
                      Ubah kepemilikan
                    </Button>
                  )}
                  {canManageRental && r.ownership === 'RENTED' && (
                    <Button size="sm" variant="ghost" onClick={() => { setError(null); setEdit({ kind: 'rate', vehicleId: v.id, effectiveFrom: today, amount: '' }); }}>Tarif baru</Button>
                  )}
                </span>
              </div>
              {history === v.id && (
                <ul className="space-y-1 rounded-lg border border-line p-2">
                  {r.history.map((h) => (
                    <li key={h.id} className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        Mulai {h.fromLabel}: {rp(h.amount)} <Badge tone={h.state === 'IN_FORCE' ? 'ok' : h.state === 'SCHEDULED' ? 'info' : 'warn'}>{h.stateLabel}</Badge>
                        {h.reason && <span className="text-ink-muted"> · betulan: {h.reason}</span>}
                        {h.endReason && <span className="text-ink-muted"> · {h.endReason}</span>}
                      </span>
                      {canManageRental && (
                        <span className="flex gap-1">
                          {h.canFix && <Button size="sm" variant="ghost" onClick={() => { setError(null); setEdit({ kind: 'fix', id: h.id, amount: String(h.amount), reason: '' }); }}>Betulkan</Button>}
                          {h.canCancel && <Button size="sm" variant="ghost" onClick={() => { setError(null); setEdit({ kind: 'cancel', id: h.id, reason: '' }); }}>Batalkan</Button>}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>

      <Dialog
        open={!!edit} onClose={() => setEdit(null)} title={title}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setEdit(null)}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></>}
      >
        {edit && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            {edit.kind === 'ownership' && (
              <>
                <Field id="own-kind" label="Kepemilikan">
                  <Select id="own-kind" value={edit.ownership} onChange={(e) => setEdit({ ...edit, ownership: e.target.value as 'OWNED' | 'RENTED' })}>
                    <option value="OWNED">Milik sendiri</option>
                    <option value="RENTED">Sewa (dibayar per ritase)</option>
                  </Select>
                </Field>
                {edit.ownership === 'RENTED' && (
                  <>
                    <Field id="own-name" label="Nama pemilik sewa"><Input id="own-name" value={edit.ownerName} onChange={(e) => setEdit({ ...edit, ownerName: e.target.value })} /></Field>
                    <Field id="own-note" label="Catatan pemilik" hint="Mis. nomor rekening atau nomor HP.">
                      <Textarea id="own-note" value={edit.ownerNote} onChange={(e) => setEdit({ ...edit, ownerNote: e.target.value })} />
                    </Field>
                  </>
                )}
              </>
            )}
            {edit.kind === 'rate' && (
              <>
                <Field id="rate-from" label="Berlaku mulai" hint="Boleh tanggal lalu. Trip sebelum tanggal ini tetap memakai tarif lama.">
                  <Input id="rate-from" type="date" value={edit.effectiveFrom} onChange={(e) => setEdit({ ...edit, effectiveFrom: e.target.value })} />
                </Field>
                <Field id="rate-amount" label="Tarif sewa per ritase (Rp)"><Input id="rate-amount" type="number" min={0} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
              </>
            )}
            {edit.kind === 'fix' && (
              <>
                <Alert tone="info">Untuk salah ketik saja. Kenaikan tarif = Tarif baru mulai tanggal berikutnya.</Alert>
                <Field id="fix-amount" label="Tarif yang benar (Rp)"><Input id="fix-amount" type="number" min={0} value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
                <Field id="fix-reason" label="Alasan (wajib)"><Textarea id="fix-reason" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></Field>
              </>
            )}
            {edit.kind === 'cancel' && (
              <Field id="cancel-reason" label="Alasan (wajib)"><Textarea id="cancel-reason" value={edit.reason} onChange={(e) => setEdit({ ...edit, reason: e.target.value })} /></Field>
            )}
          </div>
        )}
      </Dialog>
    </Card>
  );
}
