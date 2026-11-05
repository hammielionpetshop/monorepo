'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { NO_REQUEST_REASONS } from '../rules/fuel';
import { rupiah } from '../rules/rates';
import type { FollowupRow } from '../server/driver-trip';
import type { FuelFillRow } from '../server/fuel';

type Option = { id: number; label: string; lastDriverId: number | null };
type Driver = { id: number; name: string };
type Period = { from: string; to: string; total: number; count: number; noRequest: number };

type Mode =
  | { kind: 'fill'; request: FollowupRow }
  | { kind: 'record' }
  | { kind: 'correct'; fill: FuelFillRow }
  | { kind: 'void'; fill: FuelFillRow };

const STATE = { CURRENT: null, REPLACED: 'Diganti', VOIDED: 'Dibatalkan' } as const;

/**
 * Bensin (spec LT1 §17.1 butir 1–4): permintaan driver → Finance isi nominal + foto struk; Catat bensin tanpa permintaan
 * (driver lupa minta); Ubah / Batal beralasan. Angka yang berlaku menjadi sumber uang keluar untuk modul Keuangan nanti.
 */
export function FuelPanel({ requests, canRecord, vehicles, drivers, fills, period }: {
  requests: FollowupRow[]; canRecord: boolean; vehicles: Option[]; drivers: Driver[]; fills: FuelFillRow[]; period: Period;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<Mode | null>(null);
  const [amount, setAmount] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [vehicleId, setVehicleId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [reasonCode, setReasonCode] = useState<'FORGOT' | 'OTHER'>('FORGOT');
  const [reasonText, setReasonText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Mode) {
    setMode(next);
    setError(null);
    setPhoto(null);
    setReasonText('');
    setReasonCode('FORGOT');
    if (next.kind === 'correct') {
      setAmount(String(next.fill.amount));
      setVehicleId(String(next.fill.vehicleId));
      setDriverId(String(next.fill.driverId));
    } else {
      setAmount('');
      setVehicleId('');
      setDriverId('');
    }
  }

  function pickVehicle(value: string) {
    setVehicleId(value);
    const last = vehicles.find((v) => String(v.id) === value)?.lastDriverId;
    if (last && drivers.some((d) => d.id === last)) setDriverId(String(last));
  }

  async function submit() {
    if (!mode) return;
    const form = new FormData();
    form.append('action', mode.kind);
    const digits = amount.replace(/\D/g, '');
    if (mode.kind !== 'void') form.append('amount', digits);
    if (mode.kind === 'fill') form.append('requestId', String(mode.request.id));
    if (mode.kind === 'correct' || mode.kind === 'void') form.append('fillId', String(mode.fill.id));
    if (mode.kind === 'record' || mode.kind === 'correct') {
      form.append('vehicleId', vehicleId);
      form.append('driverId', driverId);
    }
    if (mode.kind === 'record') {
      form.append('reasonCode', reasonCode);
      form.append('reasonText', reasonText);
    }
    if (mode.kind === 'correct' || mode.kind === 'void') form.append('reason', reasonText);
    if (photo) form.append('photo', photo, photo.name || 'struk.jpg');
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics/fuel', form);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(mode.kind === 'void' ? 'Catatan bensin dibatalkan.' : 'Bensin tersimpan.', 'ok');
    setMode(null);
    router.refresh();
  }

  const fromRequest = mode?.kind === 'correct' && mode.fill.withRequest;
  const title = !mode ? '' : mode.kind === 'fill' ? `Isi bensin: ${mode.request.vehicle}` : mode.kind === 'record' ? 'Catat bensin (tanpa permintaan)'
    : mode.kind === 'correct' ? `Ubah bensin: ${mode.fill.vehicle}` : `Batalkan bensin: ${mode.fill.vehicle}`;

  return (
    <div className="space-y-4">
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Perlu isi bensin <span className="tabular-nums text-ink-muted">{requests.length}</span> <NewBadge feature="fitur/bensin-nominal" /></h2>
          {canRecord && <Button size="sm" variant="secondary" onClick={() => open({ kind: 'record' })}>Catat bensin (tanpa permintaan)</Button>}
        </div>
        <p className="text-sm text-ink-muted">
          Dari Laporan Pulang driver. Finance mengisi nominal sesuai struk dan foto struknya. Angka ini menjadi sumber uang keluar bensin untuk modul Keuangan nanti.
        </p>
        {!requests.length ? <EmptyState title="Tidak ada permintaan bensin" /> : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line p-2 text-sm">
                <span>
                  <span className="font-medium">{r.vehicle}</span> · perkiraan driver ± <span className="tabular-nums">{rupiah(r.fuelEstimate ?? 0)}</span>
                  <span className="block text-ink-muted">{r.driver}, {r.sentOn} {r.sentAt} · <Link href={`/logistik/trip/${r.tripId}`} className="underline">{r.tripNumber}</Link></span>
                </span>
                {canRecord && <Button size="sm" onClick={() => open({ kind: 'fill', request: r })}>Isi nominal</Button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2">
        <h2 className="font-semibold">Riwayat bensin</h2>
        <p className="text-sm text-ink-muted">
          Periode {period.from} s.d. {period.to}: <span className="font-medium tabular-nums text-ink">{rupiah(period.total)}</span> dari {period.count} kali isi
          {period.noRequest ? `, ${period.noRequest} tanpa permintaan` : ''}. Riwayat 60 hari, termasuk yang diganti / dibatalkan.
        </p>
        <DataList
          rows={fills} rowKey={(r) => String(r.id)} empty="Belum ada catatan bensin."
          columns={[
            { key: 'on', header: 'Tanggal', primary: true, render: (r) => <span className={r.state !== 'CURRENT' ? 'text-ink-muted line-through' : ''}>{r.on} {r.at}</span> },
            { key: 'vehicle', header: 'Mobil', render: (r) => r.vehicle },
            { key: 'driver', header: 'Driver', render: (r) => r.driver },
            {
              key: 'amount', header: 'Nominal',
              render: (r) => <span className="tabular-nums">{rupiah(r.amount)}{r.estimate ? <span className="text-ink-muted"> (perkiraan {rupiah(r.estimate)})</span> : null}</span>,
            },
            {
              key: 'source', header: 'Asal',
              render: (r) => (r.withRequest
                ? <span>Permintaan{r.tripId ? <> · <Link href={`/logistik/trip/${r.tripId}`} className="underline">{r.tripNumber}</Link></> : null}</span>
                : <Badge tone="warn">Tanpa permintaan: {r.noRequestReason}</Badge>),
            },
            {
              key: 'state', header: 'Keterangan',
              render: (r) => (
                <span className="text-sm">
                  {STATE[r.state] && <Badge tone={r.state === 'VOIDED' ? 'danger' : 'info'}>{STATE[r.state]}</Badge>}{' '}
                  {r.voidReason ?? (r.correctionReason ? `Ubah: ${r.correctionReason}` : '')}
                  <span className="block text-ink-muted">oleh {r.recordedBy}</span>
                </span>
              ),
            },
            {
              key: 'actions', header: '',
              render: (r) => (
                <span className="flex flex-wrap gap-2">
                  <a href={r.receiptUrl} target="_blank" rel="noreferrer" className="text-sm underline">Struk</a>
                  {r.canChange && <Button size="sm" variant="secondary" onClick={() => open({ kind: 'correct', fill: r })}>Ubah</Button>}
                  {r.canChange && <Button size="sm" variant="secondary" onClick={() => open({ kind: 'void', fill: r })}>Batal</Button>}
                </span>
              ),
            },
          ]}
        />
      </Card>

      <Dialog
        open={!!mode} onClose={() => setMode(null)} title={title}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setMode(null)}>Tutup</Button>
          <Button loading={busy} onClick={submit}>{mode?.kind === 'void' ? 'Batalkan catatan' : 'Simpan'}</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {mode?.kind === 'fill' && (
            <p className="text-sm">{mode.request.driver} · perkiraan driver ± {rupiah(mode.request.fuelEstimate ?? 0)}</p>
          )}
          {(mode?.kind === 'record' || (mode?.kind === 'correct' && !fromRequest)) && (
            <>
              <Field id="fuel-vehicle" label="Mobil">
                <Select id="fuel-vehicle" value={vehicleId} onChange={(e) => pickVehicle(e.target.value)}>
                  <option value="">Pilih mobil</option>
                  {vehicles.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </Select>
              </Field>
              <Field id="fuel-driver" label="Driver" hint="Terisi otomatis dari trip terakhir mobil ini; ganti bila bukan dia.">
                <Select id="fuel-driver" value={driverId} onChange={(e) => setDriverId(e.target.value)}>
                  <option value="">Pilih driver</option>
                  {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </Select>
              </Field>
            </>
          )}
          {mode && mode.kind !== 'void' && (
            <>
              <Field id="fuel-amount" label="Nominal sesuai struk (Rp)">
                <Input id="fuel-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Contoh: 300000" />
              </Field>
              <Field id="fuel-photo" label={mode.kind === 'correct' ? 'Foto struk baru (kosongkan bila tidak diganti)' : 'Foto struk'}>
                <input id="fuel-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </Field>
            </>
          )}
          {mode?.kind === 'record' && (
            <Field id="fuel-reason" label="Alasan tanpa permintaan" hint="Driver akan diberi tahu.">
              <div className="space-y-2 text-sm">
                {(['FORGOT', 'OTHER'] as const).map((code) => (
                  <label key={code} className="flex items-center gap-2">
                    <input type="radio" name="fuel-reason" checked={reasonCode === code} onChange={() => setReasonCode(code)} /> {NO_REQUEST_REASONS[code]}
                  </label>
                ))}
                {reasonCode === 'OTHER' && <Textarea id="fuel-reason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={300} />}
              </div>
            </Field>
          )}
          {(mode?.kind === 'correct' || mode?.kind === 'void') && (
            <Field id="fuel-change-reason" label={mode.kind === 'void' ? 'Alasan batal' : 'Alasan ubah'} hint="Paling sedikit 5 huruf. Catatan lama tetap tersimpan di riwayat.">
              <Textarea id="fuel-change-reason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={500} />
            </Field>
          )}
        </div>
      </Dialog>
    </div>
  );
}
