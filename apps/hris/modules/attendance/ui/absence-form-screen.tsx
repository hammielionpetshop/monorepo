'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { AbsenceKind } from '../rules/absence';

type KindOption = { kind: AbsenceKind; label: string; deadline: string; disabledReason: string | null };
type Preview = {
  kindLabel: string; sudden: boolean; range: string; workdays: number; workdayLabels: string[]; skippedText: string | null;
  cut: boolean; endDate: string; leave: { before: number; after: number } | null; warnings: string[];
};

type Props = {
  onBehalf: boolean;
  people: { id: number; name: string }[];
  employeeId: number | null;
  subjectName: string | null;
  subjectProblem: string | null;
  today: string;
  kinds: KindOption[];
  relations: { value: string; label: string }[];
  leave: { text: string; balance: number | null } | null;
  rules: { sickNoLetterMaxDays: number; letterGraceDays: number; bereavementDays: number };
  prefill?: Record<string, unknown> | null;
  resubmittedFromId?: number | null;
  presetKind?: AbsenceKind | null;
};

type Form = { kind: AbsenceKind | null; startDate: string; endDate: string; reason: string; relation: string; letterPending: boolean };

const STEPS = ['Jenis', 'Tanggal', 'Isian', 'Periksa'];
const SWITCH_HINT = 'Pilih sakit dengan surat dokter';

/**
 * KEH-L30 Ajukan Izin, Sakit, atau Cuti (4 langkah) dan KEH-L34 Isikan atas Nama (langkah 0 memilih orang).
 * Semua hitungan (hari kerja, batas waktu, label mendadak, sisa cuti) dari server lewat pratinjau.
 */
export function AbsenceFormScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const prefill = props.prefill ?? {};
  const initial: Form = {
    kind: (prefill.kind as AbsenceKind | undefined) ?? props.presetKind ?? null,
    startDate: String(prefill.startDate ?? ''), endDate: String(prefill.endDate ?? ''),
    reason: String(prefill.reason ?? ''), relation: String(prefill.relation ?? ''), letterPending: prefill.letterPending === true,
  };
  const [form, setForm] = useState<Form>(initial);
  const [step, setStep] = useState(initial.kind ? 1 : 0);
  const [photo, setPhoto] = useState<File | null>(null);
  const [onBehalfReason, setOnBehalfReason] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kind = props.kinds.find((option) => option.kind === form.kind) ?? null;
  const fields = () => ({
    ...form, endDate: form.endDate || form.startDate,
    ...(props.onBehalf ? { employeeId: props.employeeId, onBehalf: true, onBehalfReason } : {}),
  });

  function reset() {
    setForm({ kind: null, startDate: '', endDate: '', reason: '', relation: '', letterPending: false });
    setPhoto(null);
    setPreview(null);
    setError(null);
    setStep(0);
  }

  async function runPreview(next: number) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/attendance/absence', { action: 'preview', fields: fields() });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menghitung.');
    setPreview(result.data as unknown as Preview);
    setStep(next);
  }

  function nextFromDetails() {
    setError(null);
    if (form.kind === 'SICK_LETTER' && !form.letterPending && !photo) return setError('Lampirkan foto surat dokter atau pilih Surat menyusul.');
    if (props.onBehalf && onBehalfReason.trim().length < 5) return setError('Isi alasan kenapa diisikan atas nama orang ini.');
    void runPreview(3);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const attachmentIds: string[] = [];
    if (form.kind === 'SICK_LETTER' && !form.letterPending && photo) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) {
        setBusy(false);
        return setError(uploaded.error ?? 'Foto gagal diunggah.');
      }
      attachmentIds.push(String(uploaded.data?.id));
    }
    const result = await postJson('/api/requests', {
      kind: 'submit', typeKey: 'absence', fields: fields(), attachmentIds, resubmittedFromId: props.resubmittedFromId ?? null,
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Pengajuan gagal dikirim.');
    toast(String(result.data?.message ?? 'Pengajuan terkirim.'), 'ok');
    router.push(`/pengajuan/${result.data?.id}`);
    router.refresh();
  }

  if (props.onBehalf && !props.employeeId) {
    return (
      <Card>
        <Field id="ab-person" label="Pilih orang" hint="Semua cabang, tidak termasuk diri Anda. Pemilik dan GM tidak tampil.">
          <Select id="ab-person" value="" onChange={(e) => router.push(`/kehadiran/isikan?orang=${e.target.value}`)}>
            <option value="">—</option>
            {props.people.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
          </Select>
        </Field>
      </Card>
    );
  }
  if (props.subjectProblem) return <Alert tone="warn">{props.subjectProblem}</Alert>;

  return (
    <div className="space-y-4">
      {props.onBehalf && (
        <Alert>
          Diisikan atas nama <strong>{props.subjectName}</strong>. Keputusannya oleh penyetuju lain, bukan Anda.{' '}
          <button type="button" className="underline" onClick={() => router.push('/kehadiran/isikan')}>Ganti orang</button>
        </Alert>
      )}
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, index) => (
          <li key={label} className={`rounded-full px-3 py-1 ${index === step ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-muted'}`}>
            {index + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="grid gap-3">
          {props.kinds.filter((option) => option.kind !== 'SICK_LETTER').map((option) => {
            const sick = option.kind === 'SICK';
            const disabled = Boolean(option.disabledReason);
            return (
              <button
                key={option.kind}
                type="button"
                disabled={disabled}
                onClick={() => { setForm({ ...form, kind: option.kind }); setPreview(null); setStep(1); }}
                className="rounded-card border border-line bg-surface p-4 text-left hover:bg-canvas disabled:opacity-50"
              >
                <span className="block text-base font-semibold">{sick ? 'Sakit' : option.label}</span>
                <span className="mt-1 block text-xs text-ink-muted">{disabled ? option.disabledReason : sick
                  ? `Tanpa surat paling lama ${props.rules.sickNoLetterMaxDays} hari kerja; dengan surat dokter boleh menyusul.` : option.deadline}</span>
              </button>
            );
          })}
          {props.leave && <p className="text-sm text-ink-muted">{props.leave.text}</p>}
        </div>
      )}

      {step === 1 && kind && (
        <Card>
          <div className="space-y-3">
            <p className="font-semibold">{form.kind === 'SICK' || form.kind === 'SICK_LETTER' ? 'Sakit' : kind.label}</p>
            {(form.kind === 'SICK' || form.kind === 'SICK_LETTER') && (
              <div className="flex gap-2">
                <Button variant={form.kind === 'SICK' ? 'primary' : 'secondary'} onClick={() => setForm({ ...form, kind: 'SICK', letterPending: false })}>Tanpa surat</Button>
                <Button variant={form.kind === 'SICK_LETTER' ? 'primary' : 'secondary'} onClick={() => setForm({ ...form, kind: 'SICK_LETTER' })}>Dengan surat dokter</Button>
              </div>
            )}
            <p className="text-xs text-ink-muted">{kind.deadline}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="ab-start" label="Dari tanggal">
                <Input id="ab-start" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </Field>
              <Field id="ab-end" label="Sampai tanggal" hint="Kosongkan bila hanya satu hari.">
                <Input id="ab-end" type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </Field>
            </div>
            {form.kind === 'BEREAVEMENT' && (
              <Field id="ab-rel" label="Hubungan dengan yang meninggal">
                <Select id="ab-rel" value={form.relation} onChange={(e) => setForm({ ...form, relation: e.target.value })}>
                  <option value="">—</option>
                  {props.relations.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </Select>
              </Field>
            )}
            {error && (
              <Alert tone="danger">
                {error}
                {error.includes(SWITCH_HINT) && (
                  <div className="mt-2"><Button size="sm" onClick={() => { setForm({ ...form, kind: 'SICK_LETTER' }); setError(null); }}>Ganti ke dengan surat</Button></div>
                )}
              </Alert>
            )}
            {preview && !error && <Alert tone="info">{preview.workdays} hari kerja{preview.skippedText ? ` (${preview.skippedText})` : ''}.</Alert>}
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={() => { setStep(0); setError(null); }}>Kembali</Button>
              <Button loading={busy} disabled={!form.startDate} onClick={() => runPreview(2)}>Lanjut</Button>
            </div>
          </div>
        </Card>
      )}

      {step === 2 && kind && preview && (
        <Card>
          <div className="space-y-3">
            <p className="text-sm">{preview.kindLabel}: {preview.range}, <strong>{preview.workdays} hari kerja</strong>{preview.skippedText ? ` (${preview.skippedText})` : ''}.</p>
            {(form.kind === 'PERMIT' || form.kind === 'SICK' || form.kind === 'ANNUAL_LEAVE' || form.kind === 'BEREAVEMENT') && (
              <Field id="ab-reason" label={form.kind === 'PERMIT' || form.kind === 'SICK' ? 'Alasan' : 'Catatan (tidak wajib)'}>
                <Textarea id="ab-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
              </Field>
            )}
            {form.kind === 'SICK_LETTER' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.letterPending} onChange={(e) => setForm({ ...form, letterPending: e.target.checked })} />
                  Surat menyusul (paling lambat {props.rules.letterGraceDays} hari sesudah Anda masuk kembali)
                </label>
                {!form.letterPending && (
                  <Field id="ab-photo" label="Foto surat dokter" hint="Kamera atau galeri. JPG, PNG, atau WebP, paling besar 10 MB.">
                    <input id="ab-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                  </Field>
                )}
                {form.letterPending && <p className="text-xs text-ink-muted">Selama surat belum masuk, hari itu dihitung sakit tanpa surat.</p>}
              </div>
            )}
            {form.kind === 'ANNUAL_LEAVE' && preview.leave && (
              <Alert tone="info">Sisa cuti {preview.leave.before} → {preview.leave.after} hari.</Alert>
            )}
            {props.onBehalf && (
              <Field id="ab-why" label="Alasan kenapa diisikan" hint="Wajib. Misalnya: tidak punya HP, sedang dirawat.">
                <Textarea id="ab-why" value={onBehalfReason} onChange={(e) => setOnBehalfReason(e.target.value)} />
              </Field>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-wrap justify-between gap-2">
              <Button variant="secondary" onClick={() => { setStep(1); setError(null); }}>Kembali</Button>
              <Button loading={busy} onClick={nextFromDetails}>Lanjut</Button>
            </div>
          </div>
        </Card>
      )}

      {step === 3 && preview && (
        <Card>
          <div className="space-y-3">
            <h3 className="font-semibold">Periksa</h3>
            <dl className="grid gap-1 text-sm">
              <div><dt className="inline text-ink-muted">Jenis: </dt><dd className="inline">{preview.kindLabel}</dd></div>
              <div><dt className="inline text-ink-muted">Tanggal: </dt><dd className="inline">{preview.range}</dd></div>
              <div><dt className="inline text-ink-muted">Hari kerja: </dt><dd className="inline">{preview.workdays} hari ({preview.workdayLabels.join(', ')})</dd></div>
              {preview.leave && <div><dt className="inline text-ink-muted">Sisa cuti: </dt><dd className="inline">{preview.leave.before} → {preview.leave.after} hari</dd></div>}
              {form.kind === 'SICK_LETTER' && <div><dt className="inline text-ink-muted">Surat dokter: </dt><dd className="inline">{form.letterPending ? 'Menyusul' : 'Terlampir'}</dd></div>}
            </dl>
            {preview.sudden && (
              <Alert tone="warn" title="Izin mendadak">
                Pengajuan ini dicatat sebagai izin mendadak karena kurang dari H-2. Potongannya lebih besar dari izin biasa.
              </Alert>
            )}
            {preview.warnings.map((warning) => <Alert key={warning} tone="warn">{warning}</Alert>)}
            <p className="text-sm text-ink-muted">Selama menunggu keputusan, hari itu tidak ditandai alpha.{form.kind === 'ANNUAL_LEAVE' ? ' Sisa cuti langsung terpesan.' : ''}</p>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => { setStep(2); setError(null); }}>Kembali</Button>
                <Button variant="ghost" onClick={reset}>Ulangi dari awal</Button>
              </div>
              {preview.sudden
                ? <HoldButton loading={busy} onClick={submit}>Kirim</HoldButton>
                : <Button loading={busy} onClick={submit}>Kirim</Button>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
