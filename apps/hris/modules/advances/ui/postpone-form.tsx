'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { rupiah } from '../rules/advance';

/** DRV-L32 Minta Tunda cicilan kasbon (HP): semua cicilan yang belum terpotong bergeser satu gajian bila disetujui. */
export function PostponeForm({ id, number, next, blocked, backHref }: {
  id: number; number: string; next: { amount: number; period: string } | null; blocked: string | null; backHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (reason.trim().length < 15) return setError('Alasan paling sedikit 15 huruf.');
    setBusy(true);
    const result = await postJson('/api/advances', { kind: 'postpone', id, reason: reason.trim() });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal mengirim.');
    toast(String(result.data?.message ?? 'Permintaan tunda terkirim.'), 'ok');
    router.push(backHref);
    router.refresh();
  }

  return (
    <Card className="max-w-xl space-y-4">
      <p className="text-sm">Kasbon <b>{number}</b>{next ? <> · cicilan berikutnya {rupiah(next.amount)} di gajian {next.period}</> : null}</p>
      {blocked ? <Alert tone="warn">{blocked}</Alert> : (
        <>
          <p className="text-sm text-ink-muted">Bila disetujui Pemilik atau GM, semua cicilan yang belum terpotong bergeser satu gajian. Tunda hanya 1 kali per kasbon. Bila slip cicilan itu ditutup sebelum diputuskan, permintaan gugur dan cicilan dipotong biasa.</p>
          <Field id="pp-reason" label="Alasan" hint="Paling sedikit 15 huruf."><Textarea id="pp-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        </>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass({ variant: 'secondary' })} href={backHref}>Kembali</Link>
        {!blocked && <HoldButton loading={busy} onClick={save}>Kirim permintaan tunda</HoldButton>}
      </div>
    </Card>
  );
}
