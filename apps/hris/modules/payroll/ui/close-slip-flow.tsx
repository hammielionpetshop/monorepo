'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';
import type { CloseOutcome } from '../server/payslip';
import type { SlipHold } from '../rules/payslip';
import { rupiah } from '../rules/salary';

type Ready = { slipId: number; name: string; branchName: string; net: number; carried: number; lastSlip: boolean };

const RESULT_TEXT: Record<CloseOutcome['result'], string> = { CLOSED: 'Ditutup', HELD: 'Tertahan', FAILED: 'Gagal' };

/** GAJ-L30 Tutup Slip (3 langkah): yang akan ditutup → periksa → tutup (ditahan) → hasil. */
export function CloseSlipFlow({ period, ready, held, totalNet, zeroNet, withCarry, single, objectionsWaiting = 0 }: {
  period: { start: string; key: string; label: string };
  ready: Ready[]; held: { slipId: number; name: string; holds: SlipHold[] }[];
  totalNet: number; zeroNet: string[]; withCarry: { name: string; carried: number }[]; single: boolean; objectionsWaiting?: number;
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<CloseOutcome[] | null>(null);
  const back = single && ready[0] ? `/gaji/slip/${ready[0].slipId}` : `/gaji/periode/${period.key}`;

  async function close() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/payroll', { kind: 'payslip_close', slipIds: ready.map((r) => r.slipId) });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menutup slip.');
    setOutcomes((result.data?.outcomes as CloseOutcome[]) ?? []);
    setStep(4);
    router.refresh();
  }

  if (step === 4 && outcomes) {
    const count = (r: CloseOutcome['result']) => outcomes.filter((o) => o.result === r).length;
    return (
      <Card className="space-y-3 text-sm">
        <p className="font-medium">Hasil: {count('CLOSED')} ditutup, {count('HELD')} tertahan, {count('FAILED')} gagal.</p>
        <ul className="space-y-1">
          {outcomes.map((o) => <li key={o.slipId}><b>{RESULT_TEXT[o.result]}</b> · {o.name}: {o.text}</li>)}
        </ul>
        <Link className={buttonClass({})} href={back}>Selesai</Link>
      </Card>
    );
  }

  return (
    <Card className="space-y-4 text-sm">
      <p className="text-ink-muted">Langkah {step} dari 3 · Periode {period.label}</p>
      {step === 1 && (
        <>
          <p className="font-medium">Yang akan ditutup: {ready.length} orang, jumlah bersih {rupiah(totalNet)}.</p>
          <ul className="space-y-1">
            {ready.map((r) => <li key={r.slipId}>{r.name} · {r.branchName} · bersih <b className="tabular-nums">{rupiah(r.net)}</b>{r.lastSlip ? ' · slip terakhir' : ''}</li>)}
          </ul>
          {held.length > 0 && (
            <Alert tone="warn" title="Tertahan, tidak ikut ditutup">
              <ul>{held.map((h) => <li key={h.slipId}>{h.name}: {h.holds.map((x) => x.text).join('; ')}</li>)}</ul>
            </Alert>
          )}
          {!ready.length && <Alert tone="info">Tidak ada slip yang siap ditutup.</Alert>}
        </>
      )}
      {step === 2 && (
        <>
          <p className="font-medium">Periksa sebelum mengunci</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Angka yang dikunci dihitung ulang saat menekan Tutup dan sama dengan perkiraan terakhir.</li>
            <li>Sesudah ditutup, perubahan absen, peniadaan, dan potongan periode ini masuk slip berikutnya sebagai koreksi.</li>
            <li>Mutasi Dana Disiplin dan Dana Tidak Hadir ditulis sebesar yang benar-benar terpotong.</li>
            {zeroNet.length > 0 && <li>Bersih Rp0: {zeroNet.join(', ')}. Potongannya tetap terkunci dan sisanya dibawa.</li>}
            {withCarry.length > 0 && <li>Ada sisa potongan dibawa: {withCarry.map((w) => `${w.name} ${rupiah(w.carried)}`).join(', ')}.</li>}
            {objectionsWaiting > 0 && <li>{objectionsWaiting} keberatan slip menunggu. Slip tetap bisa ditutup; keberatannya diputus di Persetujuan.</li>}
          </ul>
        </>
      )}
      {step === 3 && (
        <>
          <p className="font-medium">Tutup {ready.length} slip?</p>
          <p className="text-ink-muted">Tiap slip ditutup sendiri-sendiri; yang gagal tidak membatalkan yang lain. Orangnya diberi tahu.</p>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)} disabled={busy}>Kembali</Button> : <Link className={buttonClass({ variant: 'secondary' })} href={back}>Batal</Link>}
        {step < 3 && <Button onClick={() => setStep(step + 1)} disabled={!ready.length}>Lanjut</Button>}
        {step === 3 && <HoldButton onClick={close} loading={busy} disabled={busy || !ready.length}>Tutup slip</HoldButton>}
      </div>
    </Card>
  );
}
