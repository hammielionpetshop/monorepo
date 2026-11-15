'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { escalationSeries, multiplierLabel, type Escalation, type SickLetter } from '../rules/attendance-pay';
import { longDate, rupiah } from '../rules/salary';

type Values = Record<string, unknown>;
type Form = Record<string, string>;

const MONEY = ['payroll.overtime_rate', 'payroll.late_rate', 'payroll.fine_forgot_in', 'payroll.fine_forgot_out', 'payroll.fine_forgot_return', 'payroll.fine_forgot_surcharge', 'payroll.fine_day_off_missing'];
const DECIMAL = ['payroll.training_multiplier', 'payroll.day_off_compensation'];
const LADDERS = [
  ['payroll.ladder_permit_sick', 'Izin & sakit tanpa surat', 'Izin keperluan, izin duka, dan sakit tanpa surat dokter dihitung bersama.'],
  ['payroll.ladder_permit_sudden', 'Izin mendadak', 'Izin tanpa pemberitahuan cukup. Hitungan harinya sendiri.'],
  ['payroll.ladder_alpha', 'Alpha', 'Tidak masuk tanpa keterangan. Hitungan harinya sendiri.'],
] as const;
const LABELS: Record<string, string> = {
  'payroll.overtime_rate': 'Tarif lembur', 'payroll.late_rate': 'Tarif telat', 'payroll.ladder_permit_sick': 'Izin & sakit tanpa surat',
  'payroll.ladder_permit_sudden': 'Izin mendadak', 'payroll.ladder_alpha': 'Alpha', 'payroll.sick_letter': 'Sakit dengan surat dokter',
  'payroll.training_multiplier': 'Training', 'payroll.day_off_compensation': 'Kompensasi libur', 'payroll.fine_forgot_in': 'Denda lupa absen masuk',
  'payroll.fine_forgot_out': 'Denda lupa absen pulang', 'payroll.fine_forgot_return': 'Denda lupa Masuk Kembali',
  'payroll.fine_forgot_surcharge': 'Tambahan denda mulai kejadian ke-5', 'payroll.fine_day_off_missing': 'Denda tidak memilih libur',
  'payroll.daily_divisor': 'Pembagi gaji harian',
};

const dec = (v: unknown) => String(v ?? '').replace('.', ',');
const num = (s: string) => Number(s.trim().replace(/\./g, '').replace(',', '.'));
const decNum = (s: string) => Number(s.trim().replace(',', '.'));

function toForm(current: Values): Form {
  const form: Form = {};
  for (const key of MONEY) form[key] = String(current[key] ?? '');
  for (const key of DECIMAL) form[key] = dec(current[key]);
  form['payroll.daily_divisor'] = String(current['payroll.daily_divisor'] ?? '');
  for (const [key] of LADDERS) {
    const l = current[key] as Escalation;
    form[`${key}.start`] = dec(l?.start); form[`${key}.step`] = dec(l?.step); form[`${key}.max`] = dec(l?.max);
  }
  const s = current['payroll.sick_letter'] as SickLetter;
  form['sick.day1'] = dec(s?.day1); form['sick.day2to3'] = dec(s?.day2to3); form['sick.day4plus'] = dec(s?.day4plus);
  return form;
}

function toValues(form: Form): Values {
  const values: Values = {};
  for (const key of MONEY) values[key] = num(form[key]);
  for (const key of DECIMAL) values[key] = decNum(form[key]);
  values['payroll.daily_divisor'] = num(form['payroll.daily_divisor']);
  for (const [key] of LADDERS) values[key] = { start: decNum(form[`${key}.start`]), step: decNum(form[`${key}.step`]), max: decNum(form[`${key}.max`]) };
  values['payroll.sick_letter'] = { day1: decNum(form['sick.day1']), day2to3: decNum(form['sick.day2to3']), day4plus: decNum(form['sick.day4plus']) };
  return values;
}

function show(key: string, value: unknown): string {
  if (MONEY.includes(key)) return rupiah(Number(value));
  if (DECIMAL.includes(key)) return multiplierLabel(Number(value));
  if (key === 'payroll.daily_divisor') return `÷ ${value}`;
  if (key === 'payroll.sick_letter') { const s = value as SickLetter; return `${multiplierLabel(s.day1)} · ${multiplierLabel(s.day2to3)} · ${multiplierLabel(s.day4plus)}`; }
  const l = value as Escalation;
  return escalationSeries(l).map(multiplierLabel).join(' · ');
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** GAJ-L06 Potongan & Lembur: satu set angka bertanggal berlaku, meniru layar HRIS lama (spec L4b §3.1). */
export function PayRulesScreen({ today, current, scheduled, history, choices, canEdit, overtimeHours }: {
  today: string; current: Values;
  scheduled: { id: number; key: string; label: string; value: string; effectiveFrom: string }[];
  history: { id: number; label: string; value: string; effectiveFrom: string; cancelled: boolean }[];
  choices: string[]; canEdit: boolean; overtimeHours: { min: number; max: number };
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(current));
  const [from, setFrom] = useState(choices[0] ?? '');
  const [reason, setReason] = useState('');
  const [review, setReview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState<{ id: number; label: string; effectiveFrom: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const values = useMemo(() => toValues(form), [form]);
  const changes = Object.keys(values).filter((key) => !same(values[key], current[key]));
  const set = (key: string) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const disabled = !canEdit;

  async function save() {
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'pay_rules_save', values: Object.fromEntries(changes.map((k) => [k, values[k]])), effectiveFrom: from, reason });
    setBusy(false);
    if (!result.ok) { setReview(false); return setError(result.error ?? 'Gagal menyimpan.'); }
    toast(`Potongan & Lembur baru berlaku mulai ${longDate(from)}.`, 'ok');
    setReview(false); setReason('');
    router.refresh();
  }

  async function cancelScheduled() {
    if (!cancelling) return;
    setBusy(true);
    const result = await postJson('/api/payroll', { kind: 'pay_rule_cancel', id: cancelling.id, reason: cancelReason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membatalkan.');
    toast('Angka terjadwal dibatalkan.', 'ok');
    setCancelling(null); setCancelReason('');
    router.refresh();
  }

  const ladderPreview = (key: string) => {
    const l = values[key] as Escalation;
    return Number.isFinite(l.start) && Number.isFinite(l.step) && Number.isFinite(l.max) ? escalationSeries(l).map(multiplierLabel).join(' · ') : '—';
  };

  return (
    <div className="space-y-4">
      <Alert tone="info">Angka di sini dipakai Hitungan Kehadiran dan slip gaji. Perubahan hanya bisa berlaku mulai tanggal 26 (awal periode), supaya satu slip memakai satu set angka.</Alert>
      {scheduled.length > 0 && (
        <Card>
          <h2 className="mb-2 font-semibold">Terjadwal</h2>
          <ul className="space-y-1 text-sm">
            {scheduled.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span>Mulai <b>{longDate(s.effectiveFrom)}</b>: {s.label} menjadi {s.value}</span>
                {canEdit && <Button size="sm" variant="ghost" onClick={() => setCancelling(s)}>Batalkan</Button>}
              </li>
            ))}
          </ul>
        </Card>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="mb-2 font-semibold">Lembur dan telat</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="pr-ot" label="Tarif lembur (Rp / jam)"><Input id="pr-ot" inputMode="numeric" value={form['payroll.overtime_rate']} onChange={set('payroll.overtime_rate')} disabled={disabled} /></Field>
            <Field id="pr-late" label="Tarif telat (Rp / menit)"><Input id="pr-late" inputMode="numeric" value={form['payroll.late_rate']} onChange={set('payroll.late_rate')} disabled={disabled} /></Field>
          </div>
          <p className="mt-2 text-xs text-ink-muted">Lembur per hari diakui {overtimeHours.min}–{overtimeHours.max} jam; batas ini diatur di Pengaturan › Kehadiran.</p>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Gaji harian</h2>
          <Field id="pr-div" label="Pembagi gaji harian" hint="Gaji harian = gaji tetap sebulan ÷ angka ini">
            <Input id="pr-div" inputMode="numeric" value={form['payroll.daily_divisor']} onChange={set('payroll.daily_divisor')} disabled={disabled} />
          </Field>
        </Card>
        {LADDERS.map(([key, title, desc]) => (
          <Card key={key}>
            <h2 className="font-semibold">{title}</h2>
            <p className="mb-2 text-sm text-ink-muted">{desc}</p>
            <div className="grid grid-cols-3 gap-3">
              <Field id={`${key}-s`} label="Hari ke-1" hint="× gaji harian"><Input id={`${key}-s`} inputMode="decimal" value={form[`${key}.start`]} onChange={set(`${key}.start`)} disabled={disabled} /></Field>
              <Field id={`${key}-t`} label="Naik tiap hari" hint="0 = tidak naik"><Input id={`${key}-t`} inputMode="decimal" value={form[`${key}.step`]} onChange={set(`${key}.step`)} disabled={disabled} /></Field>
              <Field id={`${key}-m`} label="Mentok di" hint="batas tertinggi"><Input id={`${key}-m`} inputMode="decimal" value={form[`${key}.max`]} onChange={set(`${key}.max`)} disabled={disabled} /></Field>
            </div>
            <p className="mt-2 text-sm">Hari ke-1, ke-2, …: <b>{ladderPreview(key)}</b></p>
          </Card>
        ))}
        <Card>
          <h2 className="font-semibold">Sakit dengan surat dokter</h2>
          <p className="mb-2 text-sm text-ink-muted">Dihitung per periode.</p>
          <div className="grid grid-cols-3 gap-3">
            <Field id="pr-s1" label="Hari ke-1"><Input id="pr-s1" inputMode="decimal" value={form['sick.day1']} onChange={set('sick.day1')} disabled={disabled} /></Field>
            <Field id="pr-s2" label="Hari ke-2 & 3"><Input id="pr-s2" inputMode="decimal" value={form['sick.day2to3']} onChange={set('sick.day2to3')} disabled={disabled} /></Field>
            <Field id="pr-s4" label="Hari ke-4 dst"><Input id="pr-s4" inputMode="decimal" value={form['sick.day4plus']} onChange={set('sick.day4plus')} disabled={disabled} /></Field>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Training dan kompensasi libur</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="pr-tr" label="Training: potongan per hari" hint="× gaji harian, tidak naik"><Input id="pr-tr" inputMode="decimal" value={form['payroll.training_multiplier']} onChange={set('payroll.training_multiplier')} disabled={disabled} /></Field>
            <Field id="pr-comp" label="Kompensasi masuk di hari libur" hint="× gaji harian per hari"><Input id="pr-comp" inputMode="decimal" value={form['payroll.day_off_compensation']} onChange={set('payroll.day_off_compensation')} disabled={disabled} /></Field>
          </div>
        </Card>
        <Card>
          <h2 className="mb-2 font-semibold">Denda</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {['payroll.fine_forgot_in', 'payroll.fine_forgot_out', 'payroll.fine_forgot_return', 'payroll.fine_forgot_surcharge', 'payroll.fine_day_off_missing'].map((key) => (
              <Field key={key} id={key} label={`${LABELS[key]} (Rp)`}><Input id={key} inputMode="numeric" value={form[key]} onChange={set(key)} disabled={disabled} /></Field>
            ))}
          </div>
        </Card>
      </div>
      {canEdit && (
        <Card>
          <div className="flex flex-wrap items-end gap-3">
            <Field id="pr-from" label="Berlaku mulai">
              <Select id="pr-from" value={from} onChange={(e) => setFrom(e.target.value)}>{choices.map((c) => <option key={c} value={c}>{longDate(c)}</option>)}</Select>
            </Field>
            <div className="min-w-64 flex-1"><Field id="pr-reason" label="Alasan"><Textarea id="pr-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field></div>
            <Button disabled={!changes.length || !reason.trim() || !from} onClick={() => { setError(null); setReview(true); }}>Periksa ({changes.length} berubah)</Button>
          </div>
          {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
        </Card>
      )}
      <Card>
        <h2 className="mb-2 font-semibold">Riwayat</h2>
        <ul className="space-y-1 text-sm">
          {history.map((h) => (
            <li key={h.id} className={h.cancelled ? 'text-ink-muted line-through' : ''}>{longDate(h.effectiveFrom)} · {h.label}: {h.value}</li>
          ))}
        </ul>
      </Card>

      <Dialog open={review} onClose={() => setReview(false)} title="Periksa perubahan"
        footer={<><Button variant="secondary" onClick={() => setReview(false)}>Kembali</Button><HoldButton loading={busy} onClick={save}>Simpan</HoldButton></>}>
        <div className="space-y-2">
          <p>Berlaku mulai <b>{from ? longDate(from) : ''}</b> untuk semua orang bergaji bulanan:</p>
          <ul className="space-y-1">
            {changes.map((key) => <li key={key}>{LABELS[key]}: {show(key, current[key])} → <b>{show(key, values[key])}</b></li>)}
          </ul>
          <p className="text-ink-muted">Alasan: {reason}</p>
          <Badge tone="warn">Pemilik lain diberi tahu</Badge>
        </div>
      </Dialog>
      <Dialog open={cancelling != null} onClose={() => setCancelling(null)} title="Batalkan angka terjadwal"
        footer={<><Button variant="secondary" onClick={() => setCancelling(null)}>Kembali</Button><Button variant="danger" loading={busy} onClick={cancelScheduled}>Batalkan</Button></>}>
        <div className="space-y-3">
          <p>{cancelling?.label} yang akan berlaku {cancelling ? longDate(cancelling.effectiveFrom) : ''} dibatalkan; angka sekarang tetap dipakai.</p>
          <Field id="pr-cancel" label="Alasan"><Textarea id="pr-cancel" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
      <p className="text-xs text-ink-muted">Hari ini {longDate(today)}.</p>
    </div>
  );
}
