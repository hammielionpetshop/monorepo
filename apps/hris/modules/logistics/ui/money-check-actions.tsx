'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { cleanCheck, type MoneyKind } from '../rules/money-checks';
import { rupiah } from '../rules/rates';

export type CheckTarget = {
  source: 'TRUCK' | 'SELF'; paymentId: number; store: string; kind: MoneyKind; kindLabel: string; received: number; splitEditable: boolean;
  notes: { transactionId: number; number: string; bill: number | null; suggested: number }[];
};

const digits = (value: string) => value.replace(/\D/g, '').slice(0, 12);
type Line = { reported: string; match: boolean; actual: string; note: string };

/**
 * Periksa uang satu toko per nota (spec LT1 §16.1 butir 2, 3): uang menurut driver (diketik bila Bayar sebagian dengan beberapa
 * nota), lalu Cocok / Tidak cocok (jumlah sebenarnya + catatan).
 */
function CheckForm({ target, onDone }: { target: CheckTarget; onDone: (saved: boolean) => void }) {
  const toast = useToast();
  const [lines, setLines] = useState<Line[]>(target.notes.map((n) => ({ reported: String(n.suggested), match: true, actual: '', note: '' })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = target.notes.map((n, i) => {
    const l = lines[i];
    const reported = Number(l.reported || 0);
    return { transactionId: n.transactionId, reported, actual: l.match ? reported : l.actual === '' ? null : Number(l.actual), note: l.note };
  });
  const check = cleanCheck(target.kind, target.received, target.notes, input);
  const set = (i: number, patch: Partial<Line>) => { setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l))); setError(null); };
  const sumReported = input.reduce((n, l) => n + l.reported, 0);

  async function send() {
    if (!check.ok) return;
    setBusy(true);
    const result = await postJson('/api/logistics/money-checks', {
      action: 'check', source: target.source, paymentId: target.paymentId,
      lines: check.lines.map((l) => ({ transactionId: l.transactionId, reported: l.reported, actual: l.actual, note: l.note })),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(`Uang ${target.store} sudah diperiksa.`, 'ok');
    onDone(true);
  }

  return (
    <div className="space-y-3">
      {error && <Alert tone="danger">{error}</Alert>}
      <p className="text-sm">
        {target.kindLabel} menurut driver: <b className="tabular-nums">{rupiah(target.received)}</b>
        {target.kind === 'CASH' ? ' · kurang dari laporan = kurang serah atas nama pembawa.' : ' · transfer kurang tetap piutang toko (bukan tanggung jawab driver).'}
      </p>
      {target.splitEditable && (
        <Alert tone="warn">
          Bagi uang per nota sesuai ikatan uang dari driver. Saran awal: nota paling lama dulu. Jumlahnya harus {rupiah(target.received)}
          {sumReported !== target.received ? <> (sekarang {rupiah(sumReported)})</> : null}.
        </Alert>
      )}
      <ul className="space-y-3">
        {target.notes.map((n, i) => {
          const l = lines[i];
          return (
            <li key={n.transactionId} className="space-y-2 rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium">{n.number}</span>
                <span className="text-ink-muted">{n.bill != null ? `Tagihan saat Terkirim ${rupiah(n.bill)}` : 'Tagihan per nota tidak tercatat'}</span>
              </div>
              {target.splitEditable ? (
                <Field id={`rep-${n.transactionId}`} label="Uang menurut driver (Rp)">
                  <Input id={`rep-${n.transactionId}`} inputMode="numeric" value={l.reported} onChange={(e) => set(i, { reported: digits(e.target.value) })} />
                </Field>
              ) : (
                <p className="text-sm">Menurut driver: <b className="tabular-nums">{rupiah(Number(l.reported || 0))}</b></p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button variant={l.match ? 'primary' : 'secondary'} onClick={() => set(i, { match: true })}>Cocok</Button>
                <Button variant={!l.match ? 'primary' : 'secondary'} onClick={() => set(i, { match: false })}>Tidak cocok</Button>
              </div>
              {!l.match && (
                <>
                  <Field id={`act-${n.transactionId}`} label="Jumlah yang benar-benar diterima (Rp)">
                    <Input id={`act-${n.transactionId}`} inputMode="numeric" value={l.actual} onChange={(e) => set(i, { actual: digits(e.target.value) })} />
                  </Field>
                  <Field id={`note-${n.transactionId}`} label="Catatan (wajib)" hint="Contoh: ikatan uang kurang 20 ribu, sudah ditanyakan ke driver.">
                    <Textarea id={`note-${n.transactionId}`} value={l.note} maxLength={300} onChange={(e) => set(i, { note: e.target.value })} />
                  </Field>
                </>
              )}
            </li>
          );
        })}
      </ul>
      {!check.ok && <p className="text-xs text-danger-fg">{check.error}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => onDone(false)}>Batal</Button>
        <Button block loading={busy} disabled={!check.ok} onClick={send}>Simpan pemeriksaan</Button>
      </div>
    </div>
  );
}

export function MoneyCheckButton({ target }: { target: CheckTarget }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" onClick={() => setOpen(true)}>Periksa</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Periksa uang: ${target.store}`}>
        {open && <CheckForm target={target} onDone={(saved) => { setOpen(false); if (saved) router.refresh(); }} />}
      </Dialog>
    </>
  );
}

/** Batalkan pemeriksaan (spec LT1 §16.1 butir 9): alasan wajib; cara bayar terbuka lagi untuk koreksi / periksa ulang. */
export function MoneyCheckVoidButton({ source, paymentId, store }: { source: 'TRUCK' | 'SELF'; paymentId: number; store: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    const result = await postJson('/api/logistics/money-checks', { action: 'void', source, paymentId, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast(`Pemeriksaan ${store} dibatalkan.`, 'ok');
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Batalkan pemeriksaan</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Batalkan pemeriksaan: ${store}`}>
        {open && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <p className="text-sm text-ink-muted">Pemeriksaan ditandai Dibatalkan (tetap tersimpan). Cara bayar bisa dikoreksi lalu diperiksa ulang.</p>
            <Field id="void-reason" label="Alasan (wajib)">
              <Textarea id="void-reason" value={reason} maxLength={500} onChange={(e) => { setReason(e.target.value); setError(null); }} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Tutup</Button>
              <Button block variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={send}>Batalkan pemeriksaan</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
