'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { formatLongDate } from '../rules/dates';
import { GENDERS, GENDER_LABELS } from '../rules/fields';
import { WORK_STATUSES, WORK_STATUS_LABELS, type WorkStatus } from '../rules/history';
import { postJson } from './api';
import { HoldButton, StepLabel } from './shared';

type Option = { id: number; name: string };
type PositionOption = Option & { departmentName: string; highRights: boolean };

type Form = {
  name: string; phone: string; email: string; birthDate: string; gender: string;
  branchId: string; positionId: string; workStatus: WorkStatus; joinedOn: string;
};

/** Tambah Karyawan (KAR-60, Pemilik/GM): data diri → penempatan → periksa. Kode diberikan server. */
export function NewEmployeeForm({ branches, positions, today }: { branches: Option[]; positions: PositionOption[]; today: string }) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Form>({
    name: '', phone: '', email: '', birthDate: '', gender: '',
    branchId: '', positionId: '', workStatus: 'TRAINING', joinedOn: today,
  });
  const set = (key: keyof Form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });
  const branch = branches.find((b) => String(b.id) === form.branchId);
  const position = positions.find((p) => String(p.id) === form.positionId);

  function next(event: React.SyntheticEvent) {
    event.preventDefault();
    setError(null);
    if (step === 1 && form.name.trim().length < 2) return setError('Nama wajib diisi.');
    if (step === 2 && (!branch || !position || !form.joinedOn)) return setError('Cabang, jabatan, status kerja, dan tanggal bergabung wajib diisi.');
    setStep(step + 1);
  }

  async function save() {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/employees', {
      name: form.name, phone: form.phone || null, email: form.email || null, birthDate: form.birthDate || null,
      gender: form.gender || null, branchId: Number(form.branchId), positionId: Number(form.positionId),
      workStatus: form.workStatus, joinedOn: form.joinedOn,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    const code = String(result.data?.code ?? '');
    toast(`${form.name} tersimpan dengan kode ${code}. Akun dibuat lewat Akun & Tautan.`, 'ok');
    router.push(`/karyawan/${result.data?.id}`);
  }

  return (
    <Card className="max-w-xl">
      {step === 1 && (
        <form onSubmit={next} className="space-y-4">
          <StepLabel step={1} total={3} title="Data diri" />
          <Field id="name" label="Nama lengkap"><Input id="name" value={form.name} onChange={set('name')} autoFocus required /></Field>
          <Field id="phone" label="Nomor HP" hint="Boleh menyusul; diisi karyawan sendiri.">
            <Input id="phone" inputMode="tel" value={form.phone} onChange={set('phone')} />
          </Field>
          <Field id="email" label="Email"><Input id="email" type="email" value={form.email} onChange={set('email')} /></Field>
          <Field id="birthDate" label="Tanggal lahir"><Input id="birthDate" type="date" value={form.birthDate} onChange={set('birthDate')} /></Field>
          <Field id="gender" label="Jenis kelamin">
            <Select id="gender" value={form.gender} onChange={set('gender')}>
              <option value="">Belum diisi</option>
              {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
            </Select>
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end"><Button type="submit">Lanjut</Button></div>
        </form>
      )}
      {step === 2 && (
        <form onSubmit={next} className="space-y-4">
          <StepLabel step={2} total={3} title="Penempatan" />
          <Field id="branchId" label="Cabang">
            <Select id="branchId" value={form.branchId} onChange={set('branchId')} required>
              <option value="">Pilih cabang</option>
              {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
            </Select>
          </Field>
          <Field id="positionId" label="Jabatan" hint="Departemen mengikuti jabatan.">
            <Select id="positionId" value={form.positionId} onChange={set('positionId')} required>
              <option value="">Pilih jabatan</option>
              {positions.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.departmentName}</option>)}
            </Select>
          </Field>
          <Field id="workStatus" label="Status kerja">
            <Select id="workStatus" value={form.workStatus} onChange={set('workStatus')}>
              {WORK_STATUSES.map((s) => <option key={s} value={s}>{WORK_STATUS_LABELS[s]}</option>)}
            </Select>
          </Field>
          <Field id="joinedOn" label="Tanggal bergabung">
            <Input id="joinedOn" type="date" value={form.joinedOn} onChange={set('joinedOn')} required />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button>
            <Button type="submit">Lanjut</Button>
          </div>
        </form>
      )}
      {step === 3 && (
        <div className="space-y-4">
          <StepLabel step={3} total={3} title="Periksa" />
          <p>
            <strong>{form.name}</strong> mulai bekerja sebagai <strong>{position?.name}</strong> di <strong>{branch?.name}</strong>{' '}
            dengan status <strong>{WORK_STATUS_LABELS[form.workStatus]}</strong> mulai {formatLongDate(form.joinedOn)}.
          </p>
          <p className="text-sm text-ink-muted">
            Kode karyawan diberikan sistem setelah disimpan. Akun masuk dibuat terpisah lewat Akun & Tautan.
          </p>
          {position?.highRights && <Alert tone="warn">Jabatan ini berhak tinggi.</Alert>}
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(2)} disabled={busy}>Kembali</Button>
            <HoldButton onClick={save} loading={busy}>Simpan karyawan</HoldButton>
          </div>
        </div>
      )}
    </Card>
  );
}
