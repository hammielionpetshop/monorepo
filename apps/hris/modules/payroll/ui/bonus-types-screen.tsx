'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { BONUS_FUND_LABELS, type BonusFund } from '../rules/funds';
import { longDate } from '../rules/salary';
import { ReasonDialog } from './bonus-approval-screen';

type BonusType = {
  kind: string; label: string; key: string; percent: number; bornAs: string; from: string; ownerAllowed: boolean; example: string;
  scheduled: { id: number; value: number; effectiveFrom: string }[]; recipients: string[];
};

/** GAJ-L23 Jenis Bonus (spec L4d §4, §9 butir 8): persen diubah Pemilik/GM mulai tanggal 26; penerima diatur di Pengaturan Jabatan. */
type TypedType = { id: number; name: string; defaultFund: BonusFund; active: boolean; used: number };

/** Jenis ketik (L4d-2): nama, sumber dana bawaan, aktif. Hanya Pemilik/GM yang menambah dan mengubah (§9 butir 8). */
function TypedTypes({ typed, canEdit }: { typed: TypedType[]; canEdit: boolean }) {
  const [editing, setEditing] = useState<Partial<TypedType> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();
  async function save() {
    if (!editing) return;
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'bonus_type_save', id: editing.id, name: editing.name ?? '', defaultFund: editing.defaultFund ?? 'OFFICE', active: editing.active });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    toast('Jenis bonus disimpan.', 'ok');
    setEditing(null);
    setError(null);
    router.refresh();
  }
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-semibold">Bonus Bebas dan jenis ketik</h2>
        <NewBadge feature="fitur/jenis-bonus-ketik" />
      </div>
      <p className="text-sm text-ink-muted">Diketik per orang dengan alasan; disahkan per baris oleh Pemilik atau GM. Semua jabatan kecuali Pemilik dan GM. Sumber dana dipilih per baris, bawaannya di sini.</p>
      <ul className="space-y-2 text-sm">
        {typed.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2">
            <b>{t.name}</b>
            <Badge tone="info">{BONUS_FUND_LABELS[t.defaultFund]}</Badge>
            {!t.active && <Badge tone="warn">nonaktif</Badge>}
            <span className="text-ink-muted">{t.used} baris</span>
            {canEdit && <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Ubah</Button>}
          </li>
        ))}
      </ul>
      {canEdit && <Button size="sm" variant="secondary" onClick={() => setEditing({ name: '', defaultFund: 'OFFICE', active: true })}>Tambah jenis</Button>}
      {editing && (
        <Dialog open onClose={() => { setEditing(null); setError(null); }} title={editing.id ? `Ubah ${editing.name}` : 'Tambah jenis bonus'}
          footer={<><Button variant="secondary" onClick={() => { setEditing(null); setError(null); }}>Kembali</Button><Button loading={busy} onClick={save}>Simpan</Button></>}>
          <div className="space-y-3">
            <Field id="tt-name" label="Nama"><Input id="tt-name" value={editing.name ?? ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <Field id="tt-fund" label="Sumber dana bawaan">
              <Select id="tt-fund" value={editing.defaultFund ?? 'OFFICE'} onChange={(e) => setEditing({ ...editing, defaultFund: e.target.value as BonusFund })}>
                {(Object.keys(BONUS_FUND_LABELS) as BonusFund[]).map((f) => <option key={f} value={f}>{BONUS_FUND_LABELS[f]}</option>)}
              </Select>
            </Field>
            {editing.id && (
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active ?? true} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Aktif (bisa dipilih saat mencatat)</label>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
    </Card>
  );
}

export function BonusTypesScreen({ types, typed, nextStart, canEdit, canEditTyped }: { types: BonusType[]; typed: TypedType[]; nextStart: string; canEdit: boolean; canEditTyped: boolean }) {
  const [editing, setEditing] = useState<BonusType | null>(null);
  const [cancelling, setCancelling] = useState<{ id: number; value: number; effectiveFrom: string } | null>(null);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const toast = useToast();

  function close() { setEditing(null); setValue(''); setReason(''); setError(null); }
  async function save() {
    if (!editing) return;
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'bonus_percent_save', values: { [editing.key]: Number(value) }, effectiveFrom: nextStart, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal.');
    toast(`Persen bonus ${editing.label.toLowerCase()} terjadwal mulai ${longDate(nextStart)}.`, 'ok');
    close();
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <Alert tone="info">
        Jenis bonus Fase 1: Grooming dan Ongkir (dari data kasir), dan Bonus Bebas (diketik). Jabatan GM tidak menerima bonus apa pun; Pemilik hanya bonus grooming.
        Penerima per jabatan diubah di <Link className="underline" href="/pengaturan/jabatan">Pengaturan Jabatan</Link> (Penerima bonus grooming / ongkir).
      </Alert>
      {types.map((t) => (
        <Card key={t.kind} className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Bonus {t.label}</h2>
            <Badge tone="info">{t.percent}%</Badge>
            {t.ownerAllowed && <Badge tone="ok">boleh untuk jabatan Pemilik</Badge>}
          </div>
          <dl className="grid gap-1 text-sm sm:grid-cols-[10rem_1fr]">
            <dt className="text-ink-muted">Lahir dari</dt><dd>{t.from}</dd>
            <dt className="text-ink-muted">Cara disahkan</dt><dd>{t.bornAs}</dd>
            <dt className="text-ink-muted">Sumber dana</dt><dd>Uang kantor</dd>
            <dt className="text-ink-muted">Jabatan penerima</dt><dd>{t.recipients.length ? t.recipients.join(', ') : 'Belum ada'}</dd>
            <dt className="text-ink-muted">Contoh</dt><dd>{t.example}</dd>
          </dl>
          {t.scheduled.map((s) => (
            <div key={s.id} className="flex flex-wrap items-center gap-2 text-sm">
              <Badge tone="warn">Terjadwal {s.value}% mulai {longDate(s.effectiveFrom)}</Badge>
              {canEdit && <Button size="sm" variant="ghost" onClick={() => setCancelling(s)}>Batalkan jadwal</Button>}
            </div>
          ))}
          {canEdit && <Button size="sm" variant="secondary" onClick={() => { setEditing(t); setValue(String(t.percent)); }}>Ubah persen</Button>}
        </Card>
      ))}
      <TypedTypes typed={typed} canEdit={canEditTyped} />
      {editing && (
        <Dialog open onClose={close} title={`Ubah persen bonus ${editing.label.toLowerCase()}`}
          footer={<><Button variant="secondary" onClick={close}>Kembali</Button><HoldButton loading={busy} disabled={!reason.trim() || value === ''} onClick={save}>Simpan</HoldButton></>}>
          <div className="space-y-3">
            <p className="text-sm">Berlaku mulai <b>{longDate(nextStart)}</b> (pengaturan gaji hanya berubah tanggal 26). Penerimanya diberi tahu.</p>
            <Field id="bt-value" label="Persen"><Input id="bt-value" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))} /></Field>
            <Field id="bt-reason" label="Alasan"><Textarea id="bt-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        </Dialog>
      )}
      {cancelling && <ReasonDialog
        title={`Batalkan jadwal ${cancelling.value}% mulai ${longDate(cancelling.effectiveFrom)}`}
        confirm="Batalkan jadwal"
        onClose={() => setCancelling(null)}
        onSubmit={(r) => postJson('/api/payroll', { kind: 'bonus_percent_cancel', id: cancelling.id, reason: r })}
        done={() => { toast('Jadwal dibatalkan.', 'ok'); setCancelling(null); router.refresh(); }}
      />}
    </div>
  );
}
