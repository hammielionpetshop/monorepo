'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { RAISE_LEAD_DAYS } from '../rules/driver-fines';
import { addDays, longDate, rupiah } from '../rules/salary';

type Version = { id: number; effectiveOn: string; amount: number; active: boolean; reason: string; by: string; future: boolean };
type Kind = { id: number; name: string; example: string; current: { amount: number; active: boolean; effectiveOn: string } | null; versions: Version[] };

/** Jenis Denda (spec L7 §3.6): nominal dan aktif bertanggal. Naik / baru / aktif lagi ≥ 7 hari; turun / nonaktif ≥ 1 hari. */
export function FineKindsScreen({ today, canEdit, kinds }: { today: string; canEdit: boolean; kinds: Kind[] }) {
  const router = useRouter();
  const toast = useToast();
  const [editing, setEditing] = useState<Kind | 'new' | null>(null);
  async function cancelVersion(id: number) {
    const result = await postJson('/api/payroll/fines', { kind: 'fine_kind_cancel', id });
    if (!result.ok) return toast(result.error ?? 'Gagal membatalkan.', 'danger');
    toast('Perubahan terjadwal dibatalkan.', 'ok');
    router.refresh();
  }
  return (
    <div className="space-y-4">
      {canEdit && <Button onClick={() => setEditing('new')}>Tambah jenis</Button>}
      <DataList
        rows={kinds}
        rowKey={(k) => String(k.id)}
        empty="Belum ada jenis denda."
        columns={[
          { key: 'name', header: 'Jenis', primary: true, render: (k) => <span>{k.name}{k.example && <span className="block text-xs text-ink-muted">{k.example}</span>}</span> },
          {
            key: 'now', header: 'Hari ini', render: (k) => (!k.current ? <Badge tone="warn">Belum berlaku</Badge>
              : k.current.active ? <span className="tabular-nums">{rupiah(k.current.amount)}</span> : <Badge tone="danger">Nonaktif</Badge>),
          },
          {
            key: 'history', header: 'Riwayat', render: (k) => (
              <details className="text-sm"><summary className="cursor-pointer">{k.versions.length} perubahan</summary>
                <ul className="space-y-1">
                  {k.versions.map((v) => (
                    <li key={v.id}>
                      {longDate(v.effectiveOn)}: {v.active ? rupiah(v.amount) : 'nonaktif'} <span className="text-ink-muted">· {v.by} · {v.reason}</span>
                      {v.future && <Badge tone="info">Terjadwal</Badge>}
                      {v.future && canEdit && <Button size="sm" variant="ghost" onClick={() => cancelVersion(v.id)}>Batalkan</Button>}
                    </li>
                  ))}
                </ul>
              </details>
            ),
          },
          { key: 'act', header: '', render: (k) => (canEdit ? <Button size="sm" variant="ghost" onClick={() => setEditing(k)}>Ubah</Button> : null) },
        ]}
      />
      <p className="text-sm text-ink-muted">Jenis baru, nominal naik, atau aktif lagi berlaku paling cepat {RAISE_LEAD_DAYS} hari lagi; nominal turun atau nonaktif paling cepat besok. Denda yang sudah tercatat tidak ikut berubah.</p>
      {editing && <KindDialog key={editing === 'new' ? 'new' : editing.id} kind={editing === 'new' ? null : editing} today={today} onClose={() => setEditing(null)} />}
    </div>
  );
}

function KindDialog({ kind, today, onClose }: { kind: Kind | null; today: string; onClose: () => void }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(kind?.name ?? '');
  const [example, setExample] = useState(kind?.example ?? '');
  const [amount, setAmount] = useState(String(kind?.current?.amount ?? ''));
  const [active, setActive] = useState(kind?.current?.active === false ? 'NO' : 'YES');
  const [effectiveOn, setEffectiveOn] = useState(addDays(today, kind ? 1 : RAISE_LEAD_DAYS));
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const result = await postJson('/api/payroll/fines', {
      kind: 'fine_kind_save', id: kind?.id ?? null, name, example, amount: Number(amount || 0), active: active === 'YES', effectiveOn, reason,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Jenis denda disimpan.', 'ok');
    onClose();
    router.refresh();
  }
  return (
    <Dialog open onClose={onClose} title={kind ? `Ubah ${kind.name}` : 'Tambah jenis denda'}
      footer={<><Button variant="secondary" onClick={onClose}>Kembali</Button><HoldButton loading={busy} onClick={save}>Simpan</HoldButton></>}>
      <div className="space-y-3">
        <Field id="fk-name" label="Nama"><Input id="fk-name" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field id="fk-example" label="Contoh perbuatan"><Textarea id="fk-example" value={example} onChange={(e) => setExample(e.target.value)} /></Field>
        <Field id="fk-amount" label="Nominal per kejadian (rupiah)"><Input id="fk-amount" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))} /></Field>
        {kind && (
          <Field id="fk-active" label="Aktif">
            <Select id="fk-active" value={active} onChange={(e) => setActive(e.target.value)}><option value="YES">Aktif</option><option value="NO">Nonaktif</option></Select>
          </Field>
        )}
        <Field id="fk-from" label="Nominal / aktif berlaku mulai" hint="Nama dan contoh langsung berganti. Naik/aktif lagi paling cepat 7 hari lagi; turun/nonaktif paling cepat besok.">
          <Input id="fk-from" type="date" min={addDays(today, 1)} value={effectiveOn} onChange={(e) => setEffectiveOn(e.target.value)} />
        </Field>
        <Field id="fk-reason" label="Alasan" hint="Paling sedikit 15 huruf (wajib bila nominal atau aktif berubah)."><Textarea id="fk-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
