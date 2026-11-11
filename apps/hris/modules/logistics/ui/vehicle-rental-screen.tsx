'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { VehicleRentalScreenData } from '../server/vehicle-rental';

const rp = (n: number) => `Rp${new Intl.NumberFormat('id-ID').format(n)}`;

type Row = VehicleRentalScreenData['rows'][number];
type PayDraft = { row: Row; kind: 'PAYMENT' | 'TOP_UP'; due: number; occurredOn: string; placeId: string; amount: string; reason: string; photo: File | null };

/** Logistik › Sewa Mobil (F2-5b, spec F2-5 §3.3): rekap ritase mobil sewa per bulan, Bayar, Bayar susulan, batal. */
export function VehicleRentalScreen(data: VehicleRentalScreenData) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState<number | null>(null);
  const [pay, setPay] = useState<PayDraft | null>(null);
  const [cancel, setCancel] = useState<{ id: number; reason: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(form: FormData, done: (data: Record<string, unknown> | undefined) => string) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics/vehicle-rental', form);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(done(result.data), 'ok');
    router.refresh();
    return true;
  }

  function startPay(row: Row) {
    if (!row.next) return;
    setError(null);
    setPay({ row, kind: row.next.kind, due: row.next.due, occurredOn: data.today, placeId: '', amount: String(row.next.due), reason: '', photo: null });
  }

  async function submitPay() {
    if (!pay) return;
    const form = new FormData();
    form.set('action', 'pay');
    form.set('vehicleId', String(pay.row.vehicleId));
    form.set('month', data.month);
    form.set('kind', pay.kind);
    form.set('occurredOn', pay.occurredOn);
    form.set('moneyPlaceId', pay.placeId);
    form.set('amount', pay.amount);
    form.set('differenceReason', pay.reason);
    if (pay.photo) form.set('photo', pay.photo);
    if (await send(form, (d) => String(d?.message ?? 'Pembayaran tercatat.'))) setPay(null);
  }

  async function submitCancel() {
    if (!cancel) return;
    const form = new FormData();
    form.set('action', 'cancel_payment');
    form.set('id', String(cancel.id));
    form.set('reason', cancel.reason);
    if (await send(form, () => 'Pembayaran dibatalkan.')) setCancel(null);
  }

  const amountDiffers = pay ? Number(pay.amount) !== pay.due : false;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={`/logistik/sewa-mobil?bulan=${data.prev}`}>‹ Bulan sebelumnya</Link>
        <span className="font-semibold">{data.monthLabel}</span>
        <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={`/logistik/sewa-mobil?bulan=${data.next}`}>Bulan berikutnya ›</Link>
      </div>
      {!data.payable && <Alert tone="info">Bulan ini belum lewat. Sewa {data.monthLabel} baru bisa dibayar mulai {data.payableFrom}.</Alert>}
      {error && !pay && !cancel && <Alert tone="danger">{error}</Alert>}

      {data.rows.length === 0 ? (
        <EmptyState title="Belum ada mobil sewa">Tandai mobil sebagai Sewa di Logistik › Mobil & Rute.</EmptyState>
      ) : (
        <>
          <Card className="grid gap-2 text-sm sm:grid-cols-3">
            <div><div className="text-ink-muted">Ritase</div><div className="text-lg font-semibold">{data.totals.tripCount}</div></div>
            <div><div className="text-ink-muted">Total sewa</div><div className="text-lg font-semibold">{rp(data.totals.total)}</div></div>
            <div><div className="text-ink-muted">Sudah dibayar</div><div className="text-lg font-semibold">{rp(data.totals.paid)}</div></div>
          </Card>
          {data.rows.map((row) => (
            <Card key={row.vehicleId} className="space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-semibold">{row.name} ({row.plate}) {!row.rented && <Badge tone="info">Sekarang milik sendiri</Badge>}</h2>
                  <p className="text-sm text-ink-muted">Pemilik: {row.ownerName ?? '-'}{row.ownerNote ? ` · ${row.ownerNote}` : ''}</p>
                </div>
                <div className="text-right text-sm">
                  <div>{row.tripCount} ritase · <b>{rp(row.total)}</b></div>
                  <div>Sudah dibayar {rp(row.paid)} · Sisa <b>{rp(Math.max(row.remaining, 0))}</b></div>
                </div>
              </div>
              {row.unratedDates.length > 0 && (
                <Alert tone="warn">Belum bertarif: {row.unratedDates.join(', ')}. Isi tarif sewa di Mobil & Rute; rekap ini belum bisa dibayar.</Alert>
              )}
              {row.changeAfterPaid != null && row.changeAfterPaid > 0 && (
                <Alert tone="warn">Berubah sesudah dibayar: kurang {rp(row.changeAfterPaid)}. Bayar susulan untuk kekurangannya.</Alert>
              )}
              {row.changeAfterPaid != null && row.changeAfterPaid < 0 && (
                <Alert tone="warn">Berubah sesudah dibayar: lebih {rp(-row.changeAfterPaid)}. Catat untuk ditagih atau dipotong dari sewa bulan berikutnya (tidak otomatis).</Alert>
              )}
              {row.hasPayment && row.changeAfterPaid === 0 && row.remaining === 0 && <Badge tone="ok">Lunas</Badge>}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setOpen(open === row.vehicleId ? null : row.vehicleId)}>
                  {open === row.vehicleId ? 'Tutup rincian' : 'Rincian ritase'}
                </Button>
                {data.canPay && data.payable && row.next && row.unratedDates.length === 0 && (
                  <Button size="sm" onClick={() => startPay(row)}>{row.next.kind === 'PAYMENT' ? 'Bayar' : 'Bayar susulan'}</Button>
                )}
              </div>
              {open === row.vehicleId && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-ink-muted">
                      <tr><th className="py-1 pr-2">Tanggal</th><th className="py-1 pr-2">Trip</th><th className="py-1 pr-2 text-right">Tarif</th><th className="py-1 text-right">Jumlah</th></tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {row.lines.map((l) => (
                        <tr key={`${l.tripId ?? 'm'}-${l.manualId ?? l.tripId}`}>
                          <td className="py-1 pr-2">{l.dateLabel}</td>
                          <td className="py-1 pr-2">
                            {l.tripId ? <Link className="underline" href={`/logistik/trip/${l.tripId}`}>{l.tripNumber}</Link> : 'Ritase tangan'}
                          </td>
                          <td className="py-1 pr-2 text-right">{l.rate == null ? <Badge tone="warn">Belum bertarif</Badge> : rp(l.rate)}</td>
                          <td className="py-1 text-right">{rp(l.amount)}</td>
                        </tr>
                      ))}
                      {row.lines.length === 0 && <tr><td colSpan={4} className="py-2 text-ink-muted">Tidak ada trip Selesai bulan ini.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
              {row.payments.length > 0 && (
                <ul className="divide-y divide-line text-sm">
                  {row.payments.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className={p.cancelled ? 'text-ink-muted line-through' : ''}>
                        {p.kindLabel} {rp(p.amount)} · {p.occurredOn} · dari {p.place} · oleh {p.paidBy}
                        <span className="text-ink-muted"> (saat dibayar: {p.tripCount} ritase, {rp(p.billedAmount)})</span>
                        {p.differenceReason && <span className="block text-ink-muted">Alasan jumlah beda: {p.differenceReason}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        {p.cancelled && <Badge tone="danger">Batal {p.cancelled.on} oleh {p.cancelled.by}: {p.cancelled.reason}</Badge>}
                        {p.hasProof && <a className="underline" href={`/api/logistics/vehicle-rental-proof?payment=${p.id}`} target="_blank" rel="noreferrer">Foto bukti</a>}
                        {p.canCancel && <Button size="sm" variant="ghost" onClick={() => { setError(null); setCancel({ id: p.id, reason: '' }); }}>Batalkan</Button>}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          ))}
        </>
      )}

      <Dialog
        open={!!pay} onClose={() => setPay(null)}
        title={pay ? `${pay.kind === 'PAYMENT' ? 'Bayar sewa' : 'Bayar susulan'} ${pay.row.name} · ${data.monthLabel}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setPay(null)}>Batal</Button><Button loading={busy} onClick={submitPay}>Simpan pembayaran</Button></>}
      >
        {pay && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <p className="text-sm">Tagihan: <b>{rp(pay.due)}</b>{pay.kind === 'PAYMENT' ? ` (${pay.row.tripCount} ritase)` : ' (kekurangan sesudah dibayar)'}.</p>
            <Field id="rent-date" label="Tanggal uang">
              <Input id="rent-date" type="date" max={data.today} value={pay.occurredOn} onChange={(e) => setPay({ ...pay, occurredOn: e.target.value })} />
            </Field>
            <Field id="rent-place" label="Dibayar dari" hint="Tempat Uang Back Office jenis Tunai atau Rekening (bukan Laci kasir).">
              <Select id="rent-place" value={pay.placeId} onChange={(e) => setPay({ ...pay, placeId: e.target.value })}>
                <option value="">Pilih Tempat Uang</option>
                {data.places.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </Select>
            </Field>
            <Field id="rent-amount" label="Jumlah dibayar">
              <Input id="rent-amount" type="number" min={1} value={pay.amount} onChange={(e) => setPay({ ...pay, amount: e.target.value })} />
            </Field>
            {amountDiffers && (
              <Field id="rent-reason" label="Alasan jumlah beda (wajib)">
                <Textarea id="rent-reason" value={pay.reason} onChange={(e) => setPay({ ...pay, reason: e.target.value })} />
              </Field>
            )}
            <Field id="rent-photo" label="Foto bukti (dianjurkan)">
              <input id="rent-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPay({ ...pay, photo: e.target.files?.[0] ?? null })} className="block w-full text-sm" />
            </Field>
          </div>
        )}
      </Dialog>

      <Dialog
        open={!!cancel} onClose={() => setCancel(null)} title="Batalkan pembayaran sewa"
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setCancel(null)}>Tutup</Button><Button variant="danger" loading={busy} onClick={submitCancel}>Batalkan pembayaran</Button></>}
      >
        {cancel && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <Field id="rent-cancel" label="Alasan (wajib)">
              <Textarea id="rent-cancel" value={cancel.reason} onChange={(e) => setCancel({ ...cancel, reason: e.target.value })} />
            </Field>
          </div>
        )}
      </Dialog>
    </div>
  );
}
