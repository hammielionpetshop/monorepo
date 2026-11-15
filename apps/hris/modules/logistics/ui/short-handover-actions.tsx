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

type Target = { source: 'TRUCK' | 'SELF'; paymentId: number; store: string; left: number };

/** Sudah diganti tunai (Finance) / Tidak dipotong (Pemilik/GM) — spec B3 butir 4. */
export function ShortSettleButton({ target, kind }: { target: Target; kind: 'CASH_REPLACED' | 'WAIVED' }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(target.left));
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cash = kind === 'CASH_REPLACED';
  const value = Number(amount || 0);
  const amountProblem = cash && (!value || value > target.left) ? `Isi 1 sampai ${rupiah(target.left)}.` : null;

  async function send() {
    setBusy(true);
    setError(null);
    let proofFileId: string | null = null;
    if (cash && photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) { setBusy(false); return setError(uploaded.error ?? 'Foto gagal diunggah.'); }
      proofFileId = String(uploaded.data?.id);
    }
    const result = await postJson('/api/logistics/money-checks', {
      action: 'settle', source: target.source, paymentId: target.paymentId, kind, amount: cash ? value : null, note, proofFileId,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(cash ? `Ganti tunai ${rupiah(value)} dicatat.` : 'Kurang serah dinyatakan tidak dipotong.', 'ok');
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <Button size="sm" variant={cash ? 'secondary' : 'ghost'} onClick={() => setOpen(true)}>{cash ? 'Sudah diganti tunai' : 'Tidak dipotong'}</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${cash ? 'Sudah diganti tunai' : 'Tidak dipotong'}: ${target.store}`}>
        {open && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <p className="text-sm text-ink-muted">
              Sisa kurang serah <b className="tabular-nums">{rupiah(target.left)}</b>.{' '}
              {cash
                ? 'Uang pengganti diterima Finance dari pembawanya. Bila hanya sebagian, sisanya tetap bisa dijadikan Potongan Lain.'
                : 'Sisa kurang serah dimaafkan dan tidak dipotong dari gaji. Catatan tetap tersimpan.'}
            </p>
            {cash && (
              <>
                <Field id="sh-amount" label="Nominal diterima (Rp)">
                  <Input id="sh-amount" inputMode="numeric" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 12)); setError(null); }} />
                </Field>
                {amountProblem && <p className="text-xs text-danger-fg">{amountProblem}</p>}
                <Field id="sh-photo" label="Foto bukti (boleh dilewati)">
                  <Input id="sh-photo" type="file" accept="image/*" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
                </Field>
              </>
            )}
            <Field id="sh-note" label={cash ? 'Catatan (wajib)' : 'Alasan (wajib)'}>
              <Textarea id="sh-note" value={note} maxLength={500} onChange={(e) => { setNote(e.target.value); setError(null); }} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Tutup</Button>
              <Button block loading={busy} disabled={note.trim().length < 5 || !!amountProblem} onClick={send}>Simpan</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}

/** Batalkan catatan ganti tunai / tidak dipotong (alasan wajib). */
export function ShortSettlementVoidButton({ id, label }: { id: number; label: string }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function send() {
    setBusy(true);
    const result = await postJson('/api/logistics/money-checks', { action: 'settle_void', id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast(`${label} dibatalkan.`, 'ok');
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>Batalkan</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Batalkan: ${label}`}>
        {open && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <p className="text-sm text-ink-muted">Catatan ditandai Dibatalkan (tetap tersimpan); kurang serahnya kembali bersisa.</p>
            <Field id="shv-reason" label="Alasan (wajib)">
              <Textarea id="shv-reason" value={reason} maxLength={500} onChange={(e) => { setReason(e.target.value); setError(null); }} />
            </Field>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>Tutup</Button>
              <Button block variant="danger" loading={busy} disabled={reason.trim().length < 5} onClick={send}>Batalkan</Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
