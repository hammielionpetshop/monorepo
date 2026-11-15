'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Textarea } from '@/components/ui/field';
import { Alert } from '@/components/ui/surface';
import { postJson } from '@/lib/post-json';

/** Sudah dilihat / Buka kembali dengan catatan wajib (KEH-L37). */
export function StreakSeenButton({ flagId, seen }: { flagId: number; seen: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!open) return <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>{seen ? 'Buka kembali' : 'Sudah dilihat'}</Button>;
  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/attendance/clarification', { action: 'streak_seen', flagId, seen: !seen, note });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    setOpen(false);
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <Field id={`streak-${flagId}`} label="Catatan" hint="Wajib. Misalnya: sudah ditelepon, dirawat di rumah sakit.">
        <Textarea id={`streak-${flagId}`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {error && <Alert tone="danger">{error}</Alert>}
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => setOpen(false)}>Batal</Button>
        <Button size="sm" loading={busy} onClick={save}>Simpan</Button>
      </div>
    </div>
  );
}
