'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';

type Option = { employeeId: number; name: string; shiftName?: string; dates: { date: string; label: string; answerBy: string }[] };
type Props = {
  today: string; canSwapShift: boolean;
  incoming: { id: number; from: string; kind: string; text: string; answerBy: string; expired: boolean }[];
  mine: { id: number; to: string; kind: string; text: string; answerBy: string; status: string; statusLabel: string }[];
  myDaysOff: { date: string; label: string }[];
};

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

const TOO_LATE = 'Sudah lewat batas tukar (H-2). Anda bisa mengajukan izin biasa.';

/** KEH-L28 Tukar Libur dan Shift: ajakan ke teman satu cabang; dijawab teman tanpa persetujuan atasan (KEH-43). */
export function SwapScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<'in' | 'out'>(props.incoming.length ? 'in' : 'out');
  const [wizard, setWizard] = useState(false);
  const [step, setStep] = useState(1);
  const [kind, setKind] = useState<'DAY_OFF' | 'SHIFT'>('DAY_OFF');
  const [date, setDate] = useState('');
  const [options, setOptions] = useState<Option[] | null>(null);
  const [tooLate, setTooLate] = useState(false);
  const [friend, setFriend] = useState<{ employeeId: number; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    const result = await postJson('/api/attendance/days-off', body);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? 'Gagal.');
      return null;
    }
    return result.data ?? {};
  }

  function restart() {
    setStep(1);
    setKind('DAY_OFF');
    setDate('');
    setOptions(null);
    setFriend(null);
    setTooLate(false);
    setError(null);
  }

  async function loadOptions() {
    const data = await post({ action: 'swap_options', kind, date });
    if (!data) return;
    setOptions(data.options as Option[]);
    setTooLate(Boolean(data.tooLate));
    setFriend(null);
    setStep(3);
  }

  const chosen = options?.find((row) => row.employeeId === friend?.employeeId);
  const chosenDate = chosen?.dates.find((row) => row.date === friend?.date);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant={tab === 'in' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('in')}>Ajakan untuk saya ({props.incoming.length})</Button>
        <Button variant={tab === 'out' ? 'primary' : 'secondary'} size="sm" onClick={() => setTab('out')}>Ajakan saya</Button>
        <Button size="sm" onClick={() => { restart(); setWizard(true); }}>Ajak teman</Button>
      </div>

      {tab === 'in' && (props.incoming.length ? props.incoming.map((row) => (
        <Card key={row.id} className="space-y-2">
          <p className="font-medium">{row.from} mengajak tukar {row.kind === 'DAY_OFF' ? 'libur' : 'shift'}</p>
          <p className="text-sm">{row.text}</p>
          <p className="text-xs text-ink-muted">Jawab sebelum {shortDate(row.answerBy)} pukul 23.59.</p>
          {!row.expired && (
            <div className="flex gap-2">
              <Button loading={busy} onClick={async () => {
                if (await post({ action: 'swap_answer', id: row.id, accept: true })) { toast('Tukar diterima. Jadwal kalian berdua sudah berubah.', 'ok'); router.refresh(); }
              }}>Terima</Button>
              <Button variant="secondary" loading={busy} onClick={async () => {
                if (await post({ action: 'swap_answer', id: row.id, accept: false })) { toast('Ajakan ditolak.', 'info'); router.refresh(); }
              }}>Tolak</Button>
            </div>
          )}
        </Card>
      )) : <Alert tone="info">Tidak ada ajakan yang menunggu jawaban Anda.</Alert>)}

      {tab === 'out' && (props.mine.length ? props.mine.map((row) => (
        <Card key={row.id} className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="font-medium">Ke {row.to}</p>
            <Badge tone={row.status === 'ACCEPTED' ? 'ok' : row.status === 'PENDING' ? 'info' : 'warn'}>{row.statusLabel}</Badge>
          </div>
          <p className="text-sm">{row.text}</p>
          {row.status === 'PENDING' && (
            <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
              if (await post({ action: 'swap_cancel', id: row.id })) { toast('Ajakan dibatalkan.', 'info'); router.refresh(); }
            }}>Batalkan</Button>
          )}
          {(row.status === 'EXPIRED' || row.status === 'REJECTED') && <p className="text-xs text-ink-muted">Anda bisa mengajukan izin biasa.</p>}
        </Card>
      )) : <Alert tone="info">Anda belum pernah mengajak tukar.</Alert>)}

      <Dialog
        open={wizard}
        onClose={() => setWizard(false)}
        title={`Ajak teman · langkah ${step} dari 4`}
        footer={(
          <>
            {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Button variant="secondary" onClick={() => setWizard(false)}>Batal</Button>}
            {step === 1 && <Button onClick={() => setStep(2)}>Lanjut</Button>}
            {step === 2 && <Button disabled={!date} loading={busy} onClick={loadOptions}>Lanjut</Button>}
            {step === 3 && <Button disabled={!friend} onClick={() => setStep(4)}>Lanjut</Button>}
            {step === 4 && (
              <Button loading={busy} onClick={async () => {
                if (!friend) return;
                if (await post({ action: 'swap_send', kind, date, friendId: friend.employeeId, friendDate: friend.date })) {
                  toast('Ajakan terkirim.', 'ok');
                  setWizard(false);
                  setTab('out');
                  router.refresh();
                }
              }}>Kirim</Button>
            )}
          </>
        )}
      >
        {step === 1 && (
          <Field id="sw-kind" label="Jenis">
            <Select id="sw-kind" value={kind} onChange={(e) => { setKind(e.target.value as 'DAY_OFF' | 'SHIFT'); setDate(''); }}>
              <option value="DAY_OFF">Tukar libur</option>
              {props.canSwapShift && <option value="SHIFT">Tukar shift (satu tanggal)</option>}
            </Select>
          </Field>
        )}
        {step === 2 && (kind === 'DAY_OFF' ? (
          props.myDaysOff.length ? (
            <Field id="sw-date" label="Libur saya yang ditukar">
              <Select id="sw-date" value={date} onChange={(e) => setDate(e.target.value)}>
                <option value="">Pilih</option>
                {props.myDaysOff.map((row) => <option key={row.date} value={row.date}>{row.label}</option>)}
              </Select>
            </Field>
          ) : <Alert tone="info">Anda belum punya libur yang bisa ditukar. <Link className="underline" href="/libur">Pilih libur</Link></Alert>
        ) : (
          <Field id="sw-sdate" label="Tanggal shift yang ditukar">
            <Input id="sw-sdate" type="date" min={props.today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
        ))}
        {step === 3 && options && (tooLate ? (
          <div className="space-y-2">
            <Alert tone="warn">{TOO_LATE}</Alert>
            <Link href="/pengajuan" className="underline">Ke Pengajuan Saya</Link>
          </div>
        ) : options.length ? (
          <ul className="space-y-2">
            {options.map((row) => (
              <li key={row.employeeId} className="rounded-lg border border-line p-2">
                <p className="font-medium">{row.name}{row.shiftName ? ` · shift ${row.shiftName}` : ''}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {row.dates.map((item) => (
                    <Button
                      key={item.date}
                      size="sm"
                      variant={friend?.employeeId === row.employeeId && friend.date === item.date ? 'primary' : 'secondary'}
                      onClick={() => setFriend({ employeeId: row.employeeId, date: item.date })}
                    >
                      {kind === 'DAY_OFF' ? `Libur ${item.label}` : 'Pilih'}
                    </Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        ) : <Alert tone="info">Belum ada teman satu cabang yang bisa ditukar pada tanggal itu.</Alert>)}
        {step === 4 && chosen && chosenDate && (
          <div className="space-y-2">
            {kind === 'DAY_OFF' ? (
              <>
                <p>Sesudah tukar: Anda libur <b>{shortDate(chosenDate.date)}</b>, {chosen.name} libur <b>{shortDate(date)}</b>.</p>
              </>
            ) : <p>Tanggal {shortDate(date)}: Anda memakai shift <b>{chosen.shiftName}</b>, {chosen.name} memakai shift Anda.</p>}
            <p className="text-ink-muted">{chosen.name} harus menerima sebelum {shortDate(chosenDate.answerBy)} pukul 23.59. Tidak ada pemberitahuan ke atasan.</p>
            <Button variant="ghost" size="sm" onClick={restart}>Ulangi dari awal</Button>
          </div>
        )}
        {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      </Dialog>
    </div>
  );
}
