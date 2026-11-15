'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input } from '@/components/ui/field';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Row = { id: number; name: string; sortOrder: number; active: boolean; used: number };

/** GAJ-L04 Jenis Komponen Gaji. Semua komponen dijumlah menjadi gaji tetap sebulan (GAJ-65). */
export function ComponentTypesScreen({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<{ id?: number; name: string; sortOrder: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const result = await postJson('/api/payroll', body);
    setBusy(false);
    if (!result.ok) {
      if (editing) return setError(result.error ?? 'Gagal menyimpan.');
      return toast(result.error ?? 'Gagal menyimpan.', 'danger');
    }
    toast(success, 'ok');
    setEditing(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">Semua komponen diperlakukan sama: dijumlah menjadi gaji tetap sebulan, ikut gaji harian dan prorata. Mengganti nama tidak mengubah slip yang sudah ditutup.</Alert>
      {canManage && (
        <Button onClick={() => { setEditing({ name: '', sortOrder: String((rows.at(-1)?.sortOrder ?? 0) + 1) }); setError(null); }}>Tambah jenis</Button>
      )}
      <DataList
        rows={rows}
        rowKey={(row) => row.id}
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (row) => row.name },
          { key: 'order', header: 'Urutan di slip', render: (row) => row.sortOrder },
          { key: 'used', header: 'Dipakai', render: (row) => `${row.used} orang` },
          { key: 'active', header: 'Status', render: (row) => (row.active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="warn">Nonaktif</Badge>) },
          {
            key: 'action', header: '', render: (row) => (canManage ? (
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => { setEditing({ id: row.id, name: row.name, sortOrder: String(row.sortOrder) }); setError(null); }}>Ubah</Button>
                <Button size="sm" variant="ghost" loading={busy}
                  onClick={() => send({ kind: 'component_active', id: row.id, active: !row.active }, row.active ? `${row.name} dinonaktifkan.` : `${row.name} diaktifkan lagi.`)}>
                  {row.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </span>
            ) : null),
          },
        ]}
      />
      <Dialog
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing?.id ? 'Ubah jenis komponen' : 'Tambah jenis komponen'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditing(null)}>Batal</Button>
            <Button loading={busy} onClick={() => editing && send(
              { kind: 'component_save', id: editing.id, name: editing.name, sortOrder: Number(editing.sortOrder) },
              `Jenis komponen ${editing.name} tersimpan.`,
            )}>Simpan</Button>
          </>
        )}
      >
        {editing && (
          <div className="space-y-3">
            <Field id="ct-name" label="Nama"><Input id="ct-name" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field id="ct-order" label="Urutan tampil di slip"><Input id="ct-order" inputMode="numeric" value={editing.sortOrder} onChange={(e) => setEditing({ ...editing, sortOrder: e.target.value.replace(/\D/g, '') })} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        )}
      </Dialog>
    </div>
  );
}
