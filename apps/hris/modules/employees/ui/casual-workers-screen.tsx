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

type Row = { id: number; name: string; phone: string; active: boolean; lastJoined: string | null };

/** KAR-L28 Pekerja Lepas: nama + HP, tanpa akun, absen, atau slip (DRV-45). */
export function CasualWorkersScreen({ rows, canManage }: { rows: Row[]; canManage: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [edit, setEdit] = useState<Row | 'new' | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function toggle(row: Row) {
    setBusy(row.id);
    const result = await postJson('/api/casual-workers', { kind: 'active', id: row.id, active: !row.active });
    setBusy(null);
    if (!result.ok) return toast(result.error ?? 'Gagal menyimpan.', 'danger');
    toast(row.active ? `${row.name} dinonaktifkan.` : `${row.name} aktif lagi.`, 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && <Button onClick={() => setEdit('new')}>Tambah pekerja lepas</Button>}
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Belum ada pekerja lepas."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (r) => <span>{r.name} {!r.active && <Badge tone="warn">Nonaktif</Badge>}</span> },
          { key: 'phone', header: 'Nomor HP', render: (r) => <span className="tabular-nums">{r.phone}</span> },
          { key: 'last', header: 'Terakhir ikut bongkaran', render: (r) => r.lastJoined ?? '-' },
          {
            key: 'act', header: '', render: (r) => (canManage ? (
              <span className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>Ubah</Button>
                <Button size="sm" variant="ghost" loading={busy === r.id} onClick={() => toggle(r)}>{r.active ? 'Nonaktifkan' : 'Aktifkan lagi'}</Button>
              </span>
            ) : null),
          },
        ]}
      />
      <p className="text-sm text-ink-muted">Pekerja lepas hanya dicatat nama dan nomor HP: tanpa akun, absen, slip, atau kasbon. Upah bongkarannya dibayar tunai bersama laporannya.</p>
      {edit && <EditDialog row={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
    </div>
  );
}

function EditDialog({ row, onClose }: { row: Row | null; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(row?.name ?? '');
  const [phone, setPhone] = useState(row?.phone ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/casual-workers', { kind: 'save', id: row?.id ?? null, name, phone });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(row ? 'Pekerja lepas diubah.' : 'Pekerja lepas ditambahkan.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title={row ? 'Ubah pekerja lepas' : 'Tambah pekerja lepas'}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><Button loading={busy} onClick={save}>Simpan</Button></>}>
      <div className="space-y-3">
        <Field id="cw-name" label="Nama"><Input id="cw-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field id="cw-phone" label="Nomor HP" hint="Tidak boleh sama dengan nomor karyawan atau pekerja lepas lain.">
          <Input id="cw-phone" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
