'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select } from '@/components/ui/field';
import { PeriodCalendar, type CalendarCell } from '@/components/ui/period-calendar';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { cn } from '@/lib/cn';

type Day = {
  date: string; weekend: boolean; mine: { origin: string; replacement: boolean } | null; block: string | null; friends: string[]; closed: boolean;
};

type Props = {
  today: string; periodStart: string; periodEnd: string; periods: string[]; phase: 'BEFORE' | 'OPEN' | 'LATE' | 'OVER';
  window: { opens: string; closes: string }; quota: number; picked: number; editable: boolean; late: boolean; earliest: string;
  weekendMax: number; minGap: number; myDates: string[]; lockedDates: string[]; neighbours: string[]; marked: boolean; days: Day[];
  requests: { id: number; workDate: string; label: string; status: string; statusLabel: string; by: string; reason: string }[];
  replacements: {
    id: number; workDate: string; chooseBy: string; status: string; statusLabel: string; chosenDate: string | null; movable: boolean;
    options: { date: string; label: string; block: string | null }[];
  }[];
};

const gapOf = (a: string, b: string) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000;
const isWeekend = (date: string) => [0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay());

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** KEH-L26 Pilih Libur: 3 langkah (pilih → periksa → simpan). Aturan diperiksa server; layar hanya membantu. */
export function MyDaysOffScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [selected, setSelected] = useState<string[]>(props.myDates);
  const [step, setStep] = useState<1 | 2>(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ rejected: { date: string; reason: string }[] } | null>(null);
  const [replacementChoice, setReplacementChoice] = useState<Record<number, string>>({});

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    const response = await postJson('/api/attendance/days-off', body);
    setBusy(false);
    if (!response.ok) {
      setError(response.error ?? 'Gagal menyimpan.');
      return null;
    }
    return response.data ?? {};
  }

  function toggle(date: string) {
    if (props.lockedDates.includes(date)) return;
    setSelected((current) => current.includes(date) ? current.filter((item) => item !== date)
      : current.length >= props.quota ? current : [...current, date].sort());
  }

  async function save() {
    const data = await send({ action: 'save', periodStart: props.periodStart, dates: selected });
    if (!data) return;
    const rejected = (data.rejected as { date: string; reason: string }[]) ?? [];
    setResult({ rejected });
    toast(rejected.length ? 'Sebagian tanggal tersimpan.' : 'Libur Anda tersimpan. Berlaku mulai sekarang.', rejected.length ? 'info' : 'ok');
    setStep(1);
    router.refresh();
  }

  const weekendUsed = selected.filter(isWeekend).length;
  const all = [...selected, ...props.neighbours].sort();
  const tooClose = all.some((date, index) => index > 0 && gapOf(all[index - 1], date) < props.minGap);
  const changed = selected.join() !== props.myDates.join();

  const cells: CalendarCell[] = props.days.map((day) => {
    const chosen = selected.includes(day.date);
    const replacement = day.mine?.replacement;
    const pickable = props.editable && !replacement && (chosen || (!day.block && selected.length < props.quota)) && !props.lockedDates.includes(day.date);
    return {
      date: day.date,
      label: replacement ? 'Pengganti' : chosen ? 'Libur' : day.closed ? 'Hari tutup' : day.block,
      tone: chosen || replacement ? 'selected' : day.block ? 'muted' : undefined,
      names: day.friends,
      disabled: !pickable,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {props.periods.map((start) => (
          <Link
            key={start}
            href={`/libur?period=${start}`}
            className={cn('rounded-full border px-3 py-1 text-sm', start === props.periodStart ? 'border-brand-600 text-brand-700' : 'border-line text-ink-muted')}
          >
            Periode {shortDate(start)}
          </Link>
        ))}
      </div>

      {props.requests.map((request) => (
        <Card key={request.id} className="space-y-2 border-l-4 border-l-brand-600">
          <p className="font-medium">Anda diminta masuk {request.label} oleh {request.by}</p>
          <p className="text-sm text-ink-muted">{request.reason}</p>
          {request.status === 'REQUESTED' ? (
            <Button loading={busy} onClick={async () => {
              if (await send({ action: 'work_ready', id: request.id })) { toast('Tercatat siap masuk. Tombol Masuk aktif pada tanggal itu.', 'ok'); router.refresh(); }
            }}>Siap masuk</Button>
          ) : <Badge tone="ok">{request.statusLabel}</Badge>}
          <p className="text-xs text-ink-muted">Tidak bisa? Hubungi peminta; ia yang membatalkan permintaan.</p>
        </Card>
      ))}

      {props.replacements.filter((row) => row.movable || row.status === 'CHOSEN').map((row) => (
        <Card key={row.id} className="space-y-2">
          <p className="font-medium">Libur pengganti untuk masuk {shortDate(row.workDate)}</p>
          <p className="text-sm text-ink-muted">
            {row.chosenDate ? `Dipilih ${shortDate(row.chosenDate)}.` : `Paling lambat ${shortDate(row.chooseBy)}; lewat itu hangus.`} Boleh jatuh di periode berikutnya.
          </p>
          {row.movable && (
            <div className="flex flex-wrap items-end gap-2">
              <Field id={`rep-${row.id}`} label={row.chosenDate ? 'Geser ke tanggal' : 'Pilih tanggal'}>
                <Select id={`rep-${row.id}`} value={replacementChoice[row.id] ?? ''} onChange={(e) => setReplacementChoice({ ...replacementChoice, [row.id]: e.target.value })}>
                  <option value="">Pilih</option>
                  {row.options.map((option) => (
                    <option key={option.date} value={option.date} disabled={Boolean(option.block)}>{option.label}{option.block ? ` · ${option.block}` : ''}</option>
                  ))}
                </Select>
              </Field>
              <Button loading={busy} disabled={!replacementChoice[row.id]} onClick={async () => {
                if (await send({ action: 'replacement', id: row.id, date: replacementChoice[row.id] })) { toast('Libur pengganti tersimpan.', 'ok'); router.refresh(); }
              }}>Simpan</Button>
            </div>
          )}
        </Card>
      ))}

      <Card className="space-y-1">
        <p className="font-semibold">Libur periode {shortDate(props.periodStart)} – {shortDate(props.periodEnd)}</p>
        <p className="text-sm">Terisi {props.picked} dari {props.quota}{props.quota < 4 ? ` (jatah Anda periode ini ${props.quota} hari)` : ''}</p>
        <p className="text-sm text-ink-muted">
          {props.phase === 'BEFORE' && `Jendela memilih dibuka ${shortDate(props.window.opens)}.`}
          {props.phase === 'OPEN' && `Ditutup ${shortDate(props.window.closes)} pukul 23.59. Selama terbuka, tanggal bebas digeser.`}
          {props.phase === 'LATE' && 'Jendela sudah ditutup. Libur yang sudah dipilih terkunci; geser lewat Tukar dengan teman.'}
          {props.phase === 'OVER' && 'Periode ini sudah lewat.'}
        </p>
        {props.late && props.picked < props.quota && (
          <Alert tone="warn">
            Jatah libur Anda belum lengkap.{props.marked ? ' Tanda tidak memilih libur sudah dicatat.' : ''} Pilih tanggal paling cepat {shortDate(props.earliest)}.
          </Alert>
        )}
      </Card>

      {step === 1 && (
        <>
          <p className="text-sm text-ink-muted">Ketuk tanggal untuk memilih (sampai {props.quota}). Nama di bawah tanggal = teman satu cabang yang libur.</p>
          <PeriodCalendar cells={cells} onPick={props.editable ? toggle : undefined} today={props.today} />
          <div className="flex flex-wrap gap-2">
            {props.editable && <Button disabled={!changed} onClick={() => { setError(null); setStep(2); }}>Lanjut periksa</Button>}
            {changed && <Button variant="secondary" onClick={() => setSelected(props.myDates)}>Ulangi dari awal</Button>}
            <Link href="/tukar" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm">Tukar dengan teman</Link>
          </div>
        </>
      )}

      {step === 2 && (
        <Card className="space-y-3">
          <p className="font-semibold">Periksa</p>
          <ul className="list-disc pl-5 text-sm">
            {selected.map((date) => <li key={date}>{shortDate(date)}</li>)}
            {!selected.length && <li>Tidak ada tanggal (semua dilepas)</li>}
          </ul>
          <p className="text-sm">Akhir pekan: {weekendUsed} dari {props.weekendMax}</p>
          <p className="text-sm">Jarak antar libur: {tooClose ? `kurang dari ${props.minGap} hari` : 'cukup'}</p>
          {(weekendUsed > props.weekendMax || tooClose) && <Alert tone="warn">Tanggal yang melanggar aturan akan ditolak server saat disimpan.</Alert>}
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button>
            <Button loading={busy} onClick={save}>Simpan</Button>
          </div>
        </Card>
      )}

      <Dialog open={result != null && result.rejected.length > 0} onClose={() => setResult(null)} title="Sebagian tanggal ditolak"
        footer={<Button onClick={() => setResult(null)}>OK, paham</Button>}>
        <ul className="list-disc pl-5">
          {result?.rejected.map((row) => <li key={row.date}>{shortDate(row.date)}: {row.reason}</li>)}
        </ul>
        <p className="mt-2">Tanggal lain tetap tersimpan.</p>
      </Dialog>
      <Dialog open={error != null} onClose={() => setError(null)} title="Belum bisa disimpan" footer={<Button onClick={() => setError(null)}>OK, paham</Button>}>
        {error}
      </Dialog>
    </div>
  );
}
