'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Field, Input, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import type { Cause, EventKind } from '../rules/clarification';

type Props = {
  event: {
    id: number; kind: EventKind; kindLabel: string; title: string; workDate: string; dateLabel: string; deadline: string; left: string;
    late: boolean; consequence: string;
  };
  causes: { value: Cause; label: string }[];
  series: { id: number; dateLabel: string }[];
  evidence: { shift: string | null; in: string | null; break: string | null; return: string | null; out: string | null };
  prefill: { inAt: string; outAt: string; returnAt: string };
  forgot: { label: string; nth: number; surcharge: boolean } | null;
  rules: { sickNoLetterMaxDays: number; letterGraceDays: number };
  resubmit?: Record<string, unknown> | null;
  resubmittedFromId?: number | null;
};

type Form = {
  cause: Cause | null; useSeries: boolean; inAt: string; outAt: string; returnAt: string; reason: string; lateReason: string; letterPending: boolean;
};

const SWITCH_HINT = 'Pilih sakit dengan surat dokter';

/**
 * KEH-L36 Isi Penjelasan. Langkah sesuai jenis: Alpha 4 langkah (sebab, hari, isian, periksa), lupa absen 3 langkah
 * (jam, alasan, periksa), telat/pulang cepat 2 langkah (alasan, periksa). Semua pemeriksaan diulang server saat Kirim.
 */
export function ExplainFormScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const { event } = props;
  const prefill = props.resubmit ?? {};
  const singleCause = props.causes.length === 1 ? props.causes[0].value : null;
  const initial: Form = {
    cause: (prefill.cause as Cause | undefined) ?? singleCause,
    useSeries: props.series.length > 1 && Array.isArray(prefill.eventIds) ? (prefill.eventIds as unknown[]).length > 1 : props.series.length > 1,
    inAt: String(prefill.inAt || props.prefill.inAt), outAt: String(prefill.outAt ?? props.prefill.outAt), returnAt: String(prefill.returnAt ?? props.prefill.returnAt),
    reason: String(prefill.reason ?? ''), lateReason: String(prefill.lateReason ?? ''), letterPending: false,
  };
  const [form, setForm] = useState<Form>(initial);
  const [photo, setPhoto] = useState<File | null>(null);
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAlpha = event.kind === 'ALPHA';
  const forgotCause = form.cause === 'FORGOT';
  const seriesOk = form.cause === 'SICK' || form.cause === 'SICK_LETTER' || form.cause === 'SUDDEN_PERMIT';
  const steps = useMemo(() => {
    if (isAlpha) return ['Sebab', 'Hari', 'Isian', 'Periksa'];
    if (event.kind === 'FORGOT_OUT' || event.kind === 'FORGOT_RETURN') return ['Jam', 'Alasan', 'Periksa'];
    return ['Alasan', 'Periksa'];
  }, [isAlpha, event.kind]);
  const current = steps[step];
  const days = form.useSeries && seriesOk && props.series.length > 1 ? props.series : [{ id: event.id, dateLabel: event.dateLabel }];
  const needsAttachment = form.cause === 'SICK_LETTER' && !form.letterPending;
  const optionalAttachment = event.kind === 'LATE' || event.kind === 'EARLY_LEAVE';

  const go = (next: number) => { setError(null); setStep(next); };
  const reset = () => { setForm({ ...initial, cause: singleCause, reason: '', lateReason: '' }); setPhoto(null); go(0); };

  function validateDetails(): string | null {
    if (isAlpha && forgotCause && !form.inAt) return 'Isi jam masuk.';
    if (event.kind === 'FORGOT_OUT' && !form.outAt) return 'Isi jam pulang yang benar.';
    if (event.kind === 'FORGOT_RETURN' && !form.returnAt) return 'Isi jam Masuk Kembali yang benar.';
    if (needsAttachment && !photo) return 'Lampirkan foto surat dokter atau pilih Surat menyusul.';
    if (form.reason.trim().length < 5) return 'Isi alasan.';
    if (event.late && form.lateReason.trim().length < 5) return 'Isi alasan kenapa terlambat mengajukan.';
    return null;
  }

  function next() {
    if (current === 'Sebab' && !form.cause) return setError('Pilih sebabnya.');
    if (current === 'Jam' && event.kind === 'FORGOT_OUT' && !form.outAt) return setError('Isi jam pulang yang benar.');
    if (current === 'Jam' && event.kind === 'FORGOT_RETURN' && !form.returnAt) return setError('Isi jam Masuk Kembali yang benar.');
    if (current === 'Isian' || current === 'Alasan') {
      const problem = validateDetails();
      if (problem) return setError(problem);
    }
    go(step + 1);
  }

  async function submit() {
    setBusy(true);
    setError(null);
    const attachmentIds: string[] = [];
    if (photo && (needsAttachment || optionalAttachment)) {
      const body = new FormData();
      body.append('file', photo);
      const uploaded = await postJson('/api/files', body);
      if (!uploaded.ok) {
        setBusy(false);
        return setError(uploaded.error ?? 'Foto gagal diunggah.');
      }
      attachmentIds.push(String(uploaded.data?.id));
    }
    const fields = {
      eventIds: days.map((day) => day.id), cause: form.cause,
      inAt: isAlpha && forgotCause ? form.inAt : '', outAt: (isAlpha && forgotCause) || event.kind === 'FORGOT_OUT' ? form.outAt : '',
      returnAt: event.kind === 'FORGOT_RETURN' ? form.returnAt : '', reason: form.reason, lateReason: event.late ? form.lateReason : '',
      letterPending: form.cause === 'SICK_LETTER' && form.letterPending,
    };
    const result = await postJson('/api/requests', {
      kind: 'submit', typeKey: 'clarification', fields, attachmentIds, resubmittedFromId: props.resubmittedFromId ?? null,
    });
    setBusy(false);
    if (!result.ok) {
      // Kesalahan isian (jam, alasan): kembali ke langkah isian supaya bisa dibetulkan.
      if (step === steps.length - 1 && !(result.error ?? '').includes(SWITCH_HINT)) setStep(Math.max(0, steps.length - 2));
      return setError(result.error ?? 'Penjelasan gagal dikirim.');
    }
    toast('Terkirim. Menunggu keputusan HR atau pemilik.', 'ok');
    router.push('/perlu-dijelaskan?tab=waiting');
    router.refresh();
  }

  const errorBox = error && (
    <Alert tone="danger">
      {error}
      {error.includes(SWITCH_HINT) && (
        <div className="mt-2"><Button size="sm" onClick={() => { setForm({ ...form, cause: 'SICK_LETTER' }); setError(null); setStep(steps.indexOf('Isian')); }}>Ganti ke dengan surat</Button></div>
      )}
    </Alert>
  );
  const nav = (last = false) => (
    <div className="flex flex-wrap justify-between gap-2">
      <div className="flex gap-2">
        {step > 0 && <Button variant="secondary" onClick={() => go(step - 1)}>Kembali</Button>}
        {last && <Button variant="ghost" onClick={reset}>Ulangi dari awal</Button>}
      </div>
      {!last && <Button onClick={next}>Lanjut</Button>}
    </div>
  );
  const timeField = (id: string, label: string, value: string, onChange: (v: string) => void, hint?: string) => (
    <Field id={id} label={label} hint={hint}>
      <Input id={id} type="datetime-local" value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
  const reasonFields = (
    <>
      <Field id="cl-reason" label="Alasan" hint="Wajib. Tulis singkat apa yang terjadi.">
        <Textarea id="cl-reason" value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
      </Field>
      {event.late && (
        <Field id="cl-late" label="Alasan terlambat mengajukan" hint="Wajib, terpisah dari alasan lupa.">
          <Textarea id="cl-late" value={form.lateReason} onChange={(e) => setForm({ ...form, lateReason: e.target.value })} />
        </Field>
      )}
    </>
  );
  const evidence = (
    <p className="text-xs text-ink-muted">
      Tercatat server: shift {props.evidence.shift ?? '-'}; Masuk {props.evidence.in ?? '-'}; Istirahat {props.evidence.break ?? '-'};
      {' '}Masuk Kembali {props.evidence.return ?? '-'}; foto Pulang {props.evidence.out ?? '-'}.
    </p>
  );

  return (
    <div className="space-y-4">
      <Card>
        <p className="font-semibold">{event.title} · {event.dateLabel}</p>
        <p className="text-sm text-ink-muted">{event.late ? 'Lewat batas' : `${event.left}, batas ${event.deadline}`}. {event.consequence}</p>
      </Card>
      {event.late && (
        <Alert tone="warn" title="Terlambat">Wajib alasan, disahkan HR atau pemilik, dan tercatat terlambat. Denda lupa absen tetap berlaku.</Alert>
      )}
      <ol className="flex flex-wrap gap-2 text-xs">
        {steps.map((label, index) => (
          <li key={label} className={`rounded-full px-3 py-1 ${index === step ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-muted'}`}>{index + 1}. {label}</li>
        ))}
      </ol>

      {current === 'Sebab' && (
        <div className="space-y-3">
          <div className="grid gap-3">
            {props.causes.map((cause) => (
              <button
                key={cause.value}
                type="button"
                onClick={() => { setForm({ ...form, cause: cause.value }); go(1); }}
                className={`rounded-card border p-4 text-left hover:bg-canvas ${form.cause === cause.value ? 'border-brand-600' : 'border-line bg-surface'}`}
              >
                <span className="block text-base font-semibold">{cause.label}</span>
                {cause.value === 'SICK' && <span className="mt-1 block text-xs text-ink-muted">Paling lama {props.rules.sickNoLetterMaxDays} hari kerja berturut-turut.</span>}
                {cause.value === 'SICK_LETTER' && <span className="mt-1 block text-xs text-ink-muted">Foto surat, atau menyusul paling lambat {props.rules.letterGraceDays} hari sesudah masuk kembali.</span>}
                {cause.value === 'FORGOT' && <span className="mt-1 block text-xs text-ink-muted">Isi jam masuk dan pulang Anda. Dikenai denda lupa absen.</span>}
              </button>
            ))}
          </div>
          <p className="text-xs text-ink-muted">Tidak ada pilihan &quot;pakai jatah libur&quot;.</p>
          {errorBox}
        </div>
      )}

      {current === 'Hari' && (
        <Card>
          <div className="space-y-3">
            {props.series.length > 1 && seriesOk ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={!form.useSeries} onChange={() => setForm({ ...form, useSeries: false })} /> Hari ini saja ({event.dateLabel})
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="radio" checked={form.useSeries} onChange={() => setForm({ ...form, useSeries: true })} />
                  Sama untuk {props.series.length} hari berturut-turut: {props.series.map((d) => d.dateLabel).join(', ')}
                </label>
              </div>
            ) : (
              <p className="text-sm">Hari: <strong>{event.dateLabel}</strong>{props.series.length > 1 && !seriesOk ? '. Lupa absen dijelaskan per hari karena jamnya berbeda.' : ''}</p>
            )}
            {errorBox}
            {nav()}
          </div>
        </Card>
      )}

      {(current === 'Isian' || current === 'Jam' || current === 'Alasan') && (
        <Card>
          <div className="space-y-3">
            {current !== 'Alasan' || !isAlpha ? evidence : null}
            {isAlpha && forgotCause && (
              <>
                {timeField('cl-in', 'Jam masuk', form.inAt, (v) => setForm({ ...form, inAt: v }), 'Paling awal 2 jam sebelum jam masuk shift.')}
                {timeField('cl-out', 'Jam pulang', form.outAt, (v) => setForm({ ...form, outAt: v }), 'Boleh kosong bila memang belum pulang; paling lambat 04.00 keesokan hari.')}
              </>
            )}
            {current === 'Jam' && event.kind === 'FORGOT_OUT' && timeField('cl-out', 'Jam pulang yang benar', form.outAt, (v) => setForm({ ...form, outAt: v }), 'Sesudah jam masuk, paling lambat 04.00 keesokan hari.')}
            {current === 'Jam' && event.kind === 'FORGOT_RETURN' && timeField('cl-ret', 'Jam Masuk Kembali yang benar', form.returnAt, (v) => setForm({ ...form, returnAt: v }), 'Sesudah jam Istirahat dan sebelum Pulang.')}
            {form.cause === 'SICK_LETTER' && current === 'Isian' && (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.letterPending} onChange={(e) => setForm({ ...form, letterPending: e.target.checked })} />
                  Surat menyusul (paling lambat {props.rules.letterGraceDays} hari sesudah Anda masuk kembali)
                </label>
                {!form.letterPending && (
                  <Field id="cl-photo" label="Foto surat dokter" hint="Kamera atau galeri. JPG, PNG, atau WebP, paling besar 10 MB.">
                    <input id="cl-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
                  </Field>
                )}
              </div>
            )}
            {(current === 'Isian' || current === 'Alasan') && reasonFields}
            {current === 'Alasan' && optionalAttachment && (
              <Field id="cl-att" label="Lampiran (tidak wajib)" hint="Foto bukti bila ada.">
                <input id="cl-att" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} className="block w-full text-sm" />
              </Field>
            )}
            {errorBox}
            {nav()}
          </div>
        </Card>
      )}

      {current === 'Periksa' && (
        <Card>
          <div className="space-y-3">
            <h3 className="font-semibold">Periksa</h3>
            <dl className="grid gap-1 text-sm">
              <div><dt className="inline text-ink-muted">Kejadian: </dt><dd className="inline">{event.title}</dd></div>
              <div><dt className="inline text-ink-muted">Hari: </dt><dd className="inline">{days.map((d) => d.dateLabel).join(', ')}</dd></div>
              {form.cause && <div><dt className="inline text-ink-muted">Sebab: </dt><dd className="inline">{props.causes.find((c) => c.value === form.cause)?.label}</dd></div>}
              {isAlpha && forgotCause && <div><dt className="inline text-ink-muted">Jam: </dt><dd className="inline">{form.inAt.slice(11)} – {form.outAt ? form.outAt.slice(11) : 'kosong'}</dd></div>}
              {event.kind === 'FORGOT_OUT' && <div><dt className="inline text-ink-muted">Jam pulang: </dt><dd className="inline">{form.outAt.replace('T', ' ')}</dd></div>}
              {event.kind === 'FORGOT_RETURN' && <div><dt className="inline text-ink-muted">Masuk Kembali: </dt><dd className="inline">{form.returnAt.replace('T', ' ')}</dd></div>}
              {form.cause === 'SICK_LETTER' && <div><dt className="inline text-ink-muted">Surat dokter: </dt><dd className="inline">{form.letterPending ? 'Menyusul' : 'Terlampir'}</dd></div>}
              <div><dt className="inline text-ink-muted">Alasan: </dt><dd className="inline">{form.reason}</dd></div>
            </dl>
            {props.forgot && (forgotCause || event.kind === 'FORGOT_OUT' || event.kind === 'FORGOT_RETURN') && (
              <Alert tone="warn" title="Denda lupa absen">
                Ini dikenai denda lupa absen (nominalnya tampil di slip). Bila disetujui, ini kejadian ke-{props.forgot.nth} {props.forgot.label} periode ini.
                {props.forgot.surcharge && ' Kejadian ke-5 atau lebih: ada tambahan denda.'}
              </Alert>
            )}
            {isAlpha && forgotCause && <p className="text-sm text-ink-muted">Sampai disahkan, hari itu belum lengkap dan tanpa lembur.</p>}
            {errorBox}
            <div className="flex flex-wrap justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => go(step - 1)}>Kembali</Button>
                <Button variant="ghost" onClick={reset}>Ulangi dari awal</Button>
              </div>
              {props.forgot && (forgotCause || event.kind === 'FORGOT_OUT' || event.kind === 'FORGOT_RETURN')
                ? <HoldButton loading={busy} onClick={submit}>Kirim</HoldButton>
                : <Button loading={busy} onClick={submit}>Kirim</Button>}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
