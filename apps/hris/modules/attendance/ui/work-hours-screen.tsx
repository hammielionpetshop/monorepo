'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { versionOn } from '../rules/schedule';

type Version = {
  id: number; startTime: string; endTime: string; breakMinutes: number | null; breakStartFrom: string | null;
  breakStartUntil: string | null; effectiveFrom: string; effectiveUntil: string | null; cancelled: boolean; reason: string;
};
type Shift = { id: number; name: string; active: boolean; versions: Version[] };

type Form = {
  shiftId?: number; name: string; startTime: string; endTime: string; breakMinutes: string; breakStartFrom: string;
  breakStartUntil: string; effectiveFrom: string; effectiveUntil: string; reason: string;
};

const breakText = (version: Version) => (version.breakMinutes
  ? `Istirahat ${version.breakMinutes} menit, mulai ${version.breakStartFrom}–${version.breakStartUntil}` : 'Tanpa istirahat');

export function WorkHoursScreen({ branches, branchId, shifts, closing, peopleCount, today, canEdit }: {
  branches: { id: number; name: string }[]; branchId: number | null; shifts: Shift[]; closing: string | null;
  peopleCount: number; today: string; canEdit: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form | null>(null);
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [stop, setStop] = useState<{ title: string; reason: string; body: Record<string, unknown> } | null>(null);

  const open = (shift?: Shift) => {
    const current = shift ? versionOn(shift.versions, today) : null;
    setForm({
      shiftId: shift?.id, name: shift?.name ?? '', startTime: current?.startTime ?? '', endTime: current?.endTime ?? '',
      breakMinutes: current?.breakMinutes?.toString() ?? '', breakStartFrom: current?.breakStartFrom ?? '',
      breakStartUntil: current?.breakStartUntil ?? '', effectiveFrom: '', effectiveUntil: '', reason: '',
    });
    setStep(1);
    setError(null);
  };

  async function send(body: Record<string, unknown>, success: string) {
    setBusy(true);
    const result = await postJson('/api/attendance', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal menyimpan.');
      return false;
    }
    toast(success, 'ok');
    router.refresh();
    return true;
  }

  async function save() {
    if (!form || !branchId) return;
    const done = await send({
      kind: 'shift_version', branchId, shiftId: form.shiftId, name: form.name || undefined, startTime: form.startTime, endTime: form.endTime,
      breakMinutes: form.breakMinutes ? Number(form.breakMinutes) : null, breakStartFrom: form.breakStartFrom || null,
      breakStartUntil: form.breakStartUntil || null, effectiveFrom: form.effectiveFrom, effectiveUntil: form.effectiveUntil || null,
      reason: form.reason,
    }, `Jam kerja baru berlaku mulai ${form.effectiveFrom}. Absen sebelum tanggal itu tetap memakai jam lama.`);
    if (done) setForm(null);
  }

  const set = (patch: Partial<Form>) => setForm((value) => (value ? { ...value, ...patch } : value));

  return (
    <div className="space-y-4">
      <div className="max-w-xs">
        <Field id="wh-branch" label="Cabang">
          <Select id="wh-branch" value={branchId ?? ''} onChange={(e) => router.push(`/pengaturan/jam-kerja?branch=${e.target.value}`)}>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
      </div>
      {!shifts.length && (
        <Alert tone="warn" title="Cabang ini belum punya jam kerja">Setiap cabang aktif wajib punya paling sedikit satu shift.</Alert>
      )}
      {closing && <p className="text-sm text-ink-muted">Jam tutup toko: <b>{closing}</b> (mengikuti jam pulang shift terakhir).</p>}
      {canEdit && branchId && <Button onClick={() => open()}>Tambah shift</Button>}
      {!shifts.length && <EmptyState title="Belum ada shift." />}
      {shifts.map((shift) => {
        const current = versionOn(shift.versions, today);
        return (
          <Card key={shift.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-semibold">{shift.name} {!shift.active && <Badge tone="warn">Nonaktif</Badge>}</h2>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => open(shift)}>Ubah</Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    setError(null);
                    setStop({
                      title: `${shift.active ? 'Nonaktifkan' : 'Aktifkan lagi'} shift ${shift.name}`, reason: '',
                      body: { kind: 'shift_active', shiftId: shift.id, active: !shift.active },
                    });
                  }}>{shift.active ? 'Nonaktifkan' : 'Aktifkan lagi'}</Button>
                </div>
              )}
            </div>
            <p className="mt-1 text-sm">
              {current ? <>Sekarang: <b>{current.startTime}–{current.endTime}</b>. {breakText(current)}.</> : 'Belum ada jam yang berlaku hari ini.'}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-ink-muted">
              {shift.versions.filter((version) => !version.cancelled && version.effectiveFrom > today).map((version) => (
                <li key={version.id} className="flex flex-wrap items-center gap-2">
                  <span>
                    Mulai {version.effectiveFrom}{version.effectiveUntil ? ` s.d. ${version.effectiveUntil}` : ''}: {version.startTime}–{version.endTime}
                  </span>
                  {canEdit && (
                    <Button size="sm" variant="ghost" onClick={() => {
                      setError(null);
                      setStop({ title: 'Batalkan jam kerja yang akan berlaku', reason: '', body: { kind: 'shift_version_cancel', id: version.id } });
                    }}>Batalkan</Button>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        );
      })}

      <Dialog
        open={form != null}
        onClose={() => setForm(null)}
        title={`${form?.shiftId ? `Ubah ${form.name}` : 'Tambah shift'} · langkah ${step} dari 3`}
        footer={(
          <>
            {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Button variant="secondary" onClick={() => setForm(null)}>Batal</Button>}
            {step < 3 ? <Button onClick={() => { setError(null); setStep(step + 1); }}>Lanjut</Button> : <Button loading={busy} onClick={save}>Simpan</Button>}
          </>
        )}
      >
        {form && step === 1 && (
          <div className="space-y-3">
            {!form.shiftId && <Field id="wh-name" label="Nama shift"><Input id="wh-name" value={form.name} onChange={(e) => set({ name: e.target.value })} placeholder="Pagi" /></Field>}
            <div className="grid grid-cols-2 gap-3">
              <Field id="wh-start" label="Jam masuk"><Input id="wh-start" type="time" value={form.startTime} onChange={(e) => set({ startTime: e.target.value })} /></Field>
              <Field id="wh-end" label="Jam pulang" hint="Lebih kecil dari jam masuk = keesokan hari."><Input id="wh-end" type="time" value={form.endTime} onChange={(e) => set({ endTime: e.target.value })} /></Field>
            </div>
            <Field id="wh-break" label="Lama istirahat (menit)" hint="Kosongkan semua bila shift ini tanpa istirahat."><Input id="wh-break" inputMode="numeric" value={form.breakMinutes} onChange={(e) => set({ breakMinutes: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="wh-bf" label="Boleh mulai dari"><Input id="wh-bf" type="time" value={form.breakStartFrom} onChange={(e) => set({ breakStartFrom: e.target.value })} /></Field>
              <Field id="wh-bu" label="Sampai"><Input id="wh-bu" type="time" value={form.breakStartUntil} onChange={(e) => set({ breakStartUntil: e.target.value })} /></Field>
            </div>
          </div>
        )}
        {form && step === 2 && (
          <div className="space-y-3">
            <Field id="wh-from" label="Berlaku mulai" hint="Paling cepat besok, kecuali shift baru."><Input id="wh-from" type="date" value={form.effectiveFrom} onChange={(e) => set({ effectiveFrom: e.target.value })} /></Field>
            <Field id="wh-until" label="Berlaku sampai (boleh kosong)" hint="Isi hanya untuk jam kerja momen tertentu."><Input id="wh-until" type="date" value={form.effectiveUntil} onChange={(e) => set({ effectiveUntil: e.target.value })} /></Field>
            <Field id="wh-reason" label="Alasan"><Textarea id="wh-reason" value={form.reason} onChange={(e) => set({ reason: e.target.value })} /></Field>
          </div>
        )}
        {form && step === 3 && (
          <div className="space-y-2 text-sm">
            <p>Masuk <b>{form.startTime || '-'}</b>, pulang <b>{form.endTime || '-'}</b>, mulai <b>{form.effectiveFrom || '-'}</b>{form.effectiveUntil ? ` sampai ${form.effectiveUntil}` : ''}.</p>
            <p>{form.breakMinutes ? `Istirahat ${form.breakMinutes} menit, mulai ${form.breakStartFrom}–${form.breakStartUntil}.` : 'Tanpa istirahat.'}</p>
            <p>Terkena: <b>{peopleCount} orang</b> di cabang ini; mereka diberi tahu. Absen sebelum tanggal itu tetap memakai jam lama.</p>
            {error && <Alert tone="danger">{error}</Alert>}
          </div>
        )}
      </Dialog>

      <Dialog
        open={stop != null}
        onClose={() => setStop(null)}
        title={stop?.title ?? ''}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setStop(null)}>Kembali</Button>
            <Button loading={busy} onClick={async () => {
              if (!stop) return;
              if (await send({ ...stop.body, reason: stop.reason }, 'Tersimpan.')) setStop(null);
            }}>Simpan</Button>
          </>
        )}
      >
        <div className="space-y-3">
          <Field id="wh-stop" label="Alasan"><Textarea id="wh-stop" value={stop?.reason ?? ''} onChange={(e) => setStop((value) => (value ? { ...value, reason: e.target.value } : value))} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
