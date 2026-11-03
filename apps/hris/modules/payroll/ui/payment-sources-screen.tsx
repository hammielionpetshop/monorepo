'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Row = { id: number; name: string; method: 'CASH' | 'TRANSFER'; methodLabel: string; active: boolean; sortOrder: number };

/** Pengaturan › Sumber Uang (PRD 06 §3.3): daftar tempat uang gaji dibayar. Tidak dihapus, hanya dinonaktifkan. */
export function PaymentSourcesScreen({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Row | null>(null);
  const [name, setName] = useState('');
  const [method, setMethod] = useState<'CASH' | 'TRANSFER'>('CASH');
  const [busy, setBusy] = useState(false);

  function start(row: Row | null) {
    setEditing(row);
    setName(row?.name ?? '');
    setMethod(row?.method ?? 'CASH');
  }

  async function save(body: Record<string, unknown>) {
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'payment_source_save', ...body });
    setBusy(false);
    if (!result.ok) return toast(result.error ?? 'Gagal menyimpan.', 'danger');
    toast('Sumber uang disimpan.', 'ok');
    start(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Card className="max-w-xl space-y-3 text-sm">
        <p className="font-medium">{editing ? `Ubah ${editing.name}` : 'Tambah sumber uang'}</p>
        <Field id="src-name" label="Nama" hint="Mis. Brankas, Rekening BCA Kantor.">
          <Input id="src-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="src-method" label="Cara bayar">
          <Select id="src-method" value={method} onChange={(e) => setMethod(e.target.value as 'CASH' | 'TRANSFER')}>
            <option value="CASH">Tunai</option>
            <option value="TRANSFER">Transfer</option>
          </Select>
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button loading={busy} disabled={busy || !name.trim()} onClick={() => save({
            id: editing?.id, name: name.trim(), method, active: editing?.active ?? true, sortOrder: editing?.sortOrder ?? rows.length + 1,
          })}>Simpan</Button>
          {editing && <Button variant="ghost" onClick={() => start(null)}>Batal</Button>}
        </div>
      </Card>
      <Card className="text-sm">
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium">{r.name}</span>
              <span className="text-ink-muted">{r.methodLabel}</span>
              {!r.active && <Badge tone="warn">Nonaktif</Badge>}
              <span className="ml-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => start(r)}>Ubah</Button>
                <Button size="sm" variant="ghost" disabled={busy} onClick={() => save({ id: r.id, name: r.name, method: r.method, active: !r.active, sortOrder: r.sortOrder })}>
                  {r.active ? 'Nonaktifkan' : 'Aktifkan'}
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
