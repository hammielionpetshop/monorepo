'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Ask = 'RESEND' | 'DROP' | 'REOPEN' | null;

/** Perlu keputusan (spec LT1 §3.9, §13.3 butir 7): Kirim ulang / Batal; Buka lagi (Pemilik/GM) untuk Batal logistik. */
export function NoteDecision({ noteId, number, mode, link }: { noteId: number; number: string; mode: 'decide' | 'reopen'; link: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [ask, setAsk] = useState<Ask>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function open(next: Ask) {
    setAsk(next);
    setReason('');
    setError(null);
  }

  async function run() {
    if (!ask) return;
    setBusy(true);
    setError(null);
    const result = await postJson('/api/logistics', ask === 'REOPEN'
      ? { action: 'reopen_note', noteId }
      : { action: 'decide_note', noteId, decision: ask, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(ask === 'RESEND' ? `${number} kembali ke Menunggu dikirim.` : ask === 'DROP' ? `${number} dibatalkan logistik.` : `${number} kembali ke Perlu keputusan.`, 'ok');
    setAsk(null);
    router.refresh();
  }

  const titles = { RESEND: 'Kirim ulang', DROP: 'Batalkan pengiriman', REOPEN: 'Buka lagi' } as const;
  return (
    <>
      <div className="flex flex-wrap gap-1">
        {mode === 'decide' ? (
          <>
            <Button size="sm" onClick={() => open('RESEND')}>Kirim ulang</Button>
            <Button size="sm" variant="danger" onClick={() => open('DROP')}>Batal</Button>
          </>
        ) : <Button size="sm" variant="secondary" onClick={() => open('REOPEN')}>Buka lagi</Button>}
      </div>
      <Dialog
        open={!!ask} onClose={() => setAsk(null)} title={ask ? `${titles[ask]} ${number}` : ''}
        footer={<><Button variant="secondary" disabled={busy} onClick={() => setAsk(null)}>Batal</Button><Button loading={busy} onClick={run}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          {ask === 'RESEND' && <p>Surat jalan kembali ke Menunggu dikirim bertanda tertunda, lalu bisa dimasukkan ke trip berikutnya.</p>}
          {ask === 'DROP' && (
            <>
              <Alert tone="warn" title="Batalkan juga di kasir">
                HRIS tidak mengubah nota. Batalkan atau koreksi notanya di Back Office
                {link && <> (<a href={link} target="_blank" rel="noreferrer" className="underline">buka nota</a>)</>}.
              </Alert>
              <Field id="drop-reason" label="Alasan">
                <Textarea id="drop-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
              </Field>
            </>
          )}
          {ask === 'REOPEN' && <p>Surat jalan kembali ke Perlu keputusan supaya bisa dikirim ulang.</p>}
        </div>
      </Dialog>
    </>
  );
}
