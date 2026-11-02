'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { longDate, rupiah } from '../rules/salary';

export type WaiveTarget =
  | { mode: 'waive'; employeeId: number; name: string; kind: 'LATE' | 'FINE'; fineKind: string | null; workDate: string; what: string; amount: number }
  | { mode: 'cancel'; waiverId: number; name: string; workDate: string; what: string };

/** GAJ-L10: Tiadakan (alasan → periksa → simpan ditahan) atau Batalkan peniadaan. */
export function WaiveDialog({ target, onClose }: { target: WaiveTarget | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setStep(1); setReason(''); setError(null);
    onClose();
  }

  async function save() {
    if (!target) return;
    setBusy(true);
    const body = target.mode === 'waive'
      ? { kind: 'waive', employeeId: target.employeeId, waiverKind: target.kind, fineKind: target.fineKind, workDate: target.workDate, reason }
      : { kind: 'waive_cancel', id: target.waiverId, reason };
    const result = await postJson('/api/payroll', body);
    setBusy(false);
    if (!result.ok) { setStep(1); return setError(result.error ?? 'Gagal menyimpan.'); }
    toast(target.mode === 'waive' ? `${target.what} ${target.name} ditiadakan. ${target.name} diberi tahu.` : `Peniadaan dibatalkan; potongan berlaku lagi.`, 'ok');
    close();
    router.refresh();
  }

  const title = target?.mode === 'cancel' ? 'Batalkan peniadaan' : 'Tiadakan potongan';
  return (
    <Dialog
      open={target != null}
      onClose={close}
      title={title}
      footer={step === 1 ? (
        <>
          <Button variant="secondary" onClick={close}>Kembali</Button>
          <Button onClick={() => { setError(null); setStep(2); }} disabled={!reason.trim()}>Periksa</Button>
        </>
      ) : (
        <>
          <Button variant="secondary" onClick={() => setStep(1)}>Ubah alasan</Button>
          <HoldButton variant={target?.mode === 'cancel' ? 'danger' : 'primary'} loading={busy} onClick={save}>{title}</HoldButton>
        </>
      )}
    >
      {target && step === 1 && (
        <div className="space-y-3">
          <p>{target.name} · {longDate(target.workDate)} · {target.what}</p>
          <Field id="waive-reason" label={target.mode === 'cancel' ? 'Alasan membatalkan' : 'Alasan meniadakan'}>
            <Textarea id="waive-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      )}
      {target && step === 2 && (
        <div className="space-y-2">
          {target.mode === 'waive'
            ? <p><b>{target.what}</b> {target.name} {longDate(target.workDate)}, <b>{rupiah(target.amount)}</b>, ditiadakan. Kejadiannya tetap tercatat.</p>
            : <p>Peniadaan <b>{target.what}</b> {target.name} {longDate(target.workDate)} dibatalkan; potongannya berlaku lagi.</p>}
          <p className="text-ink-muted">Alasan: {reason}</p>
          <p className="text-ink-muted">{target.name} diberi tahu tanpa nominal; pemilik lain juga diberi tahu.</p>
        </div>
      )}
    </Dialog>
  );
}
