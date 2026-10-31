'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Textarea } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { GENDER_LABELS, OWN_CONTACT_FIELDS } from '../rules/fields';
import { PLACEMENT_KIND_LABELS, WORK_STATUS_LABELS } from '../rules/history';
import type { OwnProfile } from '../server/employees';
import { ActiveBadge, LongDate, WorkStatusBadge, useMutation } from './shared';

type ContactField = (typeof OWN_CONTACT_FIELDS)[number];
const CONTACT_LABELS: Record<ContactField, string> = {
  phone: 'Nomor HP', address: 'Alamat', emergencyContactName: 'Kontak darurat (nama)',
  emergencyContactPhone: 'Kontak darurat (HP)', birthPlace: 'Tempat lahir', religion: 'Agama',
  maritalStatus: 'Status nikah', dependents: 'Jumlah tanggungan', education: 'Pendidikan',
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right">{children || '—'}</dd>
    </div>
  );
}

/** KAR-L13 Ganti password: perangkat lain keluar, perangkat ini tetap masuk (pintu L1d). */
function PasswordCard() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', repeat: '' });
  const { busy, error, setError, send } = useMutation('/api/auth/change-password');

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (form.newPassword.length < 8) return setError('Password baru minimal 8 karakter.');
    if (form.newPassword !== form.repeat) return setError('Ulangan password baru tidak sama.');
    const saved = await send({ currentPassword: form.currentPassword, newPassword: form.newPassword },
      'Password diganti. Perangkat lain sudah dikeluarkan.');
    if (saved) setOpen(false);
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Password</h2>
        <Button size="sm" variant="secondary" onClick={() => { setError(null); setForm({ currentPassword: '', newPassword: '', repeat: '' }); setOpen(true); }}>
          Ganti password
        </Button>
      </div>
      <Dialog open={open} onClose={() => setOpen(false)} title="Ganti password">
        <form onSubmit={submit} className="space-y-3">
          <Field id="pw-current" label="Password sekarang">
            <Input id="pw-current" type="password" autoComplete="current-password" value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </Field>
          <Field id="pw-new" label="Password baru" hint="Minimal 8 karakter.">
            <Input id="pw-new" type="password" autoComplete="new-password" value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </Field>
          <Field id="pw-repeat" label="Ulangi password baru">
            <Input id="pw-repeat" type="password" autoComplete="new-password" value={form.repeat}
              onChange={(e) => setForm({ ...form, repeat: e.target.value })} />
          </Field>
          <p className="text-ink-muted">Setelah diganti, semua perangkat lain keluar; perangkat ini tetap masuk.</p>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)}>Kembali</Button>
            <Button type="submit" loading={busy}>Ganti password</Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}

/** KAR-L10 Profil saya + KAR-L11 Ubah kontak. Data identitas hanya dibaca (pengajuannya menyusul di L2f). */
export function ProfileScreen({ profile }: { profile: OwnProfile }) {
  const { summary, person } = profile;
  const [form, setForm] = useState<Record<ContactField, string> | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const { busy, error, setError, send } = useMutation('/api/employees/me');

  function open() {
    setError(null);
    setForm(Object.fromEntries(OWN_CONTACT_FIELDS.map((key) => [key, person[key] == null ? '' : String(person[key])])) as Record<ContactField, string>);
  }

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!form) return;
    const changes = Object.fromEntries(OWN_CONTACT_FIELDS
      .filter((key) => (person[key] == null ? '' : String(person[key])) !== form[key])
      .map((key) => [key, key === 'dependents' ? (form[key] === '' ? null : Number(form[key])) : form[key] || null]));
    if (!Object.keys(changes).length) return setError('Tidak ada isian yang berubah.');
    if (await send({ fields: changes }, 'Kontak dan data diri tersimpan.')) setForm(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <h1 className="text-xl font-semibold">{summary.name}</h1>
        <p className="text-sm text-ink-muted">{summary.code}</p>
      </Card>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Penempatan</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowHistory(!showHistory)}>{showHistory ? 'Tutup riwayat' : 'Riwayat'}</Button>
          </div>
          <dl className="divide-y divide-line">
            <Row label="Cabang">{summary.branchName}</Row>
            <Row label="Jabatan">{summary.positionName}</Row>
            <Row label="Status kerja"><WorkStatusBadge status={summary.workStatus} /></Row>
            <Row label="Status"><ActiveBadge active={summary.activeToday} /></Row>
            <Row label="Tanggal bergabung"><LongDate value={summary.joinedOn} /></Row>
          </dl>
          {showHistory && (
            <ol className="mt-3 divide-y divide-line border-t border-line text-sm">
              {[...profile.placements].reverse().map((p) => (
                <li key={p.id} className="py-2">
                  <p className="font-medium">{PLACEMENT_KIND_LABELS[p.kind]} · <LongDate value={p.effectiveFrom} /></p>
                  <p>{p.branchName} · {p.positionName} · {WORK_STATUS_LABELS[p.workStatus]}</p>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold">Kontak dan data diri</h2>
            {profile.canEditContact && <Button size="sm" variant="secondary" onClick={open}>Ubah</Button>}
          </div>
          <dl className="divide-y divide-line">
            {OWN_CONTACT_FIELDS.map((key) => <Row key={key} label={CONTACT_LABELS[key]}>{person[key] == null ? null : String(person[key])}</Row>)}
          </dl>
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold">Data identitas</h2>
          <dl className="divide-y divide-line">
            <Row label="Nama">{person.name}</Row>
            <Row label="Tanggal lahir"><LongDate value={person.birthDate} /></Row>
            <Row label="Jenis kelamin">{person.gender ? GENDER_LABELS[person.gender] : null}</Row>
            <Row label="Rekening">{person.bankAccountNumber ? `${person.bankName ?? ''} ${person.bankAccountNumber}` : null}</Row>
          </dl>
          <p className="mt-2 text-xs text-ink-muted">Perubahan data identitas diajukan ke HR; fiturnya menyusul.</p>
        </Card>

        <PasswordCard />
      </div>

      <Dialog open={!!form} onClose={() => setForm(null)} title="Ubah kontak dan data diri">
        {form && (
          <form onSubmit={submit} className="space-y-3">
            {OWN_CONTACT_FIELDS.map((key) => (
              <Field key={key} id={`c-${key}`} label={CONTACT_LABELS[key]}>
                {key === 'address'
                  ? <Textarea id={`c-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                  : <Input id={`c-${key}`} type={key === 'dependents' ? 'number' : 'text'} inputMode={key.toLowerCase().includes('phone') ? 'tel' : undefined}
                    value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}
              </Field>
            ))}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Kembali</Button>
              <Button type="submit" loading={busy}>Simpan</Button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
