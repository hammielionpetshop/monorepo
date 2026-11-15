'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

/** Jenis Potongan Lain (GAJ-L16): daftar yang bisa ditambah; hanya Pemilik/GM mengubah; yang dipakai tidak bisa dinonaktifkan. */
export function DeductionTypesScreen({ types, canEdit }: { types: { id: number; name: string; active: boolean; inUse: boolean }[]; canEdit: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [editing, setEditing] = useState<{ id: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, done: string) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/payroll', { kind: 'other_type_save', ...body });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(done, 'ok');
    setName('');
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {!canEdit && <Alert tone="info">Hanya Pemilik atau GM yang mengubah daftar ini.</Alert>}
      {error && <Alert tone="danger">{error}</Alert>}
      <Card className="space-y-2">
        {types.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2">
            {editing?.id === t.id ? (
              <>
                <Input aria-label="Nama jenis" value={editing.name} onChange={(e) => setEditing({ id: t.id, name: e.target.value })} />
                <Button size="sm" loading={busy} onClick={() => send({ id: t.id, name: editing.name }, 'Nama jenis diubah.')}>Simpan</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>Batal</Button>
              </>
            ) : (
              <>
                <span className={t.active ? undefined : 'text-ink-muted line-through'}>{t.name}</span>
                {t.inUse && <Badge tone="info">Dipakai</Badge>}
                {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing({ id: t.id, name: t.name })}>Ubah nama</Button>}
                {canEdit && <Button size="sm" variant="ghost" disabled={t.active && t.inUse} onClick={() => send({ id: t.id, name: t.name, active: !t.active }, t.active ? 'Jenis dinonaktifkan.' : 'Jenis diaktifkan.')}>{t.active ? 'Nonaktifkan' : 'Aktifkan'}</Button>}
              </>
            )}
          </div>
        ))}
      </Card>
      {canEdit && (
        <div className="flex flex-wrap items-end gap-2">
          <Field id="dt-name" label="Jenis baru"><Input id="dt-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Button loading={busy} disabled={name.trim().length < 3} onClick={() => send({ name }, 'Jenis ditambahkan.')}>Tambah</Button>
        </div>
      )}
    </div>
  );
}
