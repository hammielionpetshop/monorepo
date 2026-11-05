'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/rates';
import {
  CHOSEN_METHODS, PAYMENT_HINTS, PAYMENT_LABELS, PROMISE_DEFAULT_DAYS, PROMISE_MAX_DAYS, cleanPayment, cleanPromise, needsPromise,
  type ChosenMethod, type PaymentMethod,
} from '../rules/store-payments';
import { addDays, wibDate } from '../rules/trip';
import { photoForm } from './capture';

export const defaultPromise = () => addDays(wibDate(new Date()), PROMISE_DEFAULT_DAYS);

/** Janji bayar sisa (spec LT1 §14.2 butir 5): wajib untuk Bayar sebagian / Tempo, bawaan 7 hari, paling lama 60 hari. */
export function PromiseField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const today = wibDate(new Date());
  return (
    <Field id="promise-date" label="Janji bayar sisa" hint={`Tanggal toko berjanji melunasi sisa. Bawaan ${PROMISE_DEFAULT_DAYS} hari, paling lama ${PROMISE_MAX_DAYS} hari.`}>
      <Input id="promise-date" type="date" value={value} min={addDays(today, 1)} max={addDays(today, PROMISE_MAX_DAYS)} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

export type CorrectTarget = {
  visitId: number | null; tripId: number; store: string; bill: number; method: PaymentMethod; received: number; promiseDate: string | null; hasProof: boolean;
  /** Tujuan antar sendiri (spec LT1 §15.4 butir 2): dikirim ke API antar sendiri, bukan kunjungan truk. */
  selfStopId?: number | null;
  /** Antar sendiri sesudah Foto 3: tunai berubah → laci menerima ulang. */
  cashNote?: string | null;
};

/**
 * Koreksi cara bayar salah tekan (spec LT1 §14.2 butir 4): tagihan tetap, pilih cara bayar yang benar + alasan. Lunas transfer
 * wajib bukti (foto lama dipakai lagi bila sebelumnya juga transfer). Dipakai Trip Saya (awak) dan Uang dari Toko (kantor).
 */
export function PaymentCorrectForm({ target, onDone }: { target: CorrectTarget; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const [method, setMethod] = useState<ChosenMethod | null>(target.method === 'NONE' ? null : target.method);
  const [partial, setPartial] = useState(target.method === 'PARTIAL' ? String(target.received) : '');
  const [promise, setPromise] = useState(target.promiseDate ?? defaultPromise());
  const [proof, setProof] = useState<File | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const clean = cleanPayment(target.bill, method, partial ? Number(partial) : null);
  const promiseCheck = clean.ok ? cleanPromise(clean.method, promise, wibDate(new Date())) : null;
  const keepsProof = target.method === 'TRANSFER' && target.hasProof;
  const proofMissing = clean.ok && clean.method === 'TRANSFER' && !proof && !keepsProof;
  const ready = clean.ok && !!promiseCheck?.ok && !proofMissing && reason.trim().length >= 5;

  async function send() {
    if (!clean.ok) return;
    setBusy(true);
    setError(null);
    const self = target.selfStopId != null;
    const result = await postJson(self ? '/api/logistics/self-delivery' : '/api/logistics/upload', photoForm({
      action: 'correct_payment', tripId: target.tripId, ...(self ? { stopId: target.selfStopId } : { visitId: target.visitId }), payMethod: clean.method,
      partialAmount: clean.method === 'PARTIAL' ? clean.received : null, promiseDate: needsPromise(clean.method) ? promise : null, reason,
    }, clean.method === 'TRANSFER' ? proof : null));
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Cara bayar ${target.store} dikoreksi.`, 'ok');
    onDone(true);
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      {target.cashNote && <Alert tone="warn">{target.cashNote}</Alert>}
      <p className="text-sm">
        Tagihan saat Terkirim: <b className="tabular-nums">{rupiah(target.bill)}</b> · sekarang <b>{PAYMENT_LABELS[target.method]}</b>
        {target.received > 0 ? <> ({rupiah(target.received)})</> : null}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {CHOSEN_METHODS.map((m) => (
          <Button key={m} className="min-h-11" variant={method === m ? 'primary' : 'secondary'} onClick={() => { setMethod(m); setError(null); }}>{PAYMENT_LABELS[m]}</Button>
        ))}
      </div>
      {method && <p className="text-sm text-ink-muted">{PAYMENT_HINTS[method]}</p>}
      {method === 'PARTIAL' && (
        <Field id="correct-partial" label="Uang cash yang diterima (Rp)" hint={`Kurang dari tagihan ${rupiah(target.bill)}.`}>
          <Input id="correct-partial" inputMode="numeric" value={partial} onChange={(e) => setPartial(e.target.value.replace(/\D/g, '').slice(0, 12))} />
        </Field>
      )}
      {method === 'PARTIAL' && partial && !clean.ok && <p className="text-xs text-danger-fg">{clean.error}</p>}
      {method && needsPromise(method) && <PromiseField value={promise} onChange={setPromise} />}
      {promiseCheck && !promiseCheck.ok && <p className="text-xs text-danger-fg">{promiseCheck.error}</p>}
      {method === 'TRANSFER' && (
        <Field id="correct-proof" label="Foto bukti transfer" hint={keepsProof ? 'Kosongkan untuk memakai bukti transfer yang sudah ada.' : 'Wajib. Foto layar HP toko atau struk transfer.'}>
          <input id="correct-proof" type="file" accept="image/*" className="block w-full text-sm" onChange={(e) => setProof(e.target.files?.[0] ?? null)} />
        </Field>
      )}
      <Field id="correct-reason" label="Alasan koreksi (wajib)" hint="Contoh: salah tekan, toko ternyata bayar cash penuh.">
        <Textarea id="correct-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
      </Field>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => onDone(false)}>Batal</Button>
        <Button block loading={busy} disabled={!ready} onClick={send}>Simpan koreksi</Button>
      </div>
    </div>
  );
}

/** Tombol Koreksi + dialog untuk kantor (Uang dari Toko). */
export function PaymentCorrectButton({ target }: { target: CorrectTarget }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>Koreksi</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Koreksi cara bayar: ${target.store}`}>
        {open && <PaymentCorrectForm target={target} onDone={(saved) => { setOpen(false); if (saved) router.refresh(); }} />}
      </Dialog>
    </>
  );
}
