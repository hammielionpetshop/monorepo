'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { linkFixScreen } from '../server/slip-objection';

type Data = NonNullable<Awaited<ReturnType<typeof linkFixScreen>>>;

/** Tautkan pembetulan (GAJ-111): pilih satu catatan pembetul milik orang itu yang lahir sesudah keputusan. */
export function LinkFixForm({ data }: { data: Data }) {
  const router = useRouter();
  const toast = useToast();
  const [picked, setPicked] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const back = `/persetujuan/${data.requestId}`;

  if (data.linked) return <Alert tone="ok" title="Sudah ditautkan">{data.linked}</Alert>;

  async function save() {
    const [kind, id] = picked.split(':');
    if (!kind) return setError('Pilih catatan pembetulnya.');
    setBusy(true);
    setError(null);
    const result = await postJson('/api/payroll', { kind: 'objection_link', requestId: data.requestId, fixKind: kind, fixId: Number(id) });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menautkan.');
    toast(String(result.data?.message ?? 'Pembetulan ditautkan.'), 'ok');
    router.push(back);
    router.refresh();
  }

  return (
    <Card className="max-w-2xl space-y-4 text-sm">
      <p>{data.name} · slip {data.slip}</p>
      <p className="text-ink-muted">Jalan pembetulan: {data.fixPath}. Disetujui {data.approvedAt}. Hanya catatan milik orang ini yang lahir atau berubah sesudah keputusan yang bisa dipilih.</p>
      {data.candidates.length === 0 ? (
        <EmptyState title="Belum ada catatan pembetul">Betulkan dulu lewat jalan pembetulannya, lalu kembali ke sini.</EmptyState>
      ) : (
        <fieldset className="space-y-2">
          {data.candidates.map((c) => {
            const value = `${c.kind}:${c.id}`;
            return (
              <label key={value} className="flex items-start gap-2 rounded-lg border border-line p-2">
                <input type="radio" name="fix" className="mt-1" checked={picked === value} onChange={() => setPicked(value)} />
                <span><span className="font-medium">{c.kindLabel}</span> · {c.text}<span className="block text-xs text-ink-muted">{c.at}</span></span>
              </label>
            );
          })}
        </fieldset>
      )}
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <Link className={buttonClass({ variant: 'secondary' })} href={back}>Kembali</Link>
        {data.candidates.length > 0 && <HoldButton loading={busy} onClick={save}>Tautkan</HoldButton>}
      </div>
    </Card>
  );
}
