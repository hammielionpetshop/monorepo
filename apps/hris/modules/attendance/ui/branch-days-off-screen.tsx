'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { TabNav } from './tab-nav';

type Person = { pickId: number; employeeId: number; name: string; origin: string; editable: boolean; work: string | null };
type Props = {
  branches: { id: number; name: string }[]; branchId: number | null; periods: string[]; periodStart: string; today: string;
  days: { date: string; weekend: boolean; closed: boolean; cap: number; people: Person[] }[];
  missing: { employeeId: number; name: string; quota: number; picked: number; marked: boolean }[];
  swaps: { id: number; kind: string; from: string; to: string; fromDate: string; toDate: string; at: string }[];
  swapCounts: { name: string; count: number }[];
  canChange: boolean; canRevoke: boolean; canRequestWork: boolean; selfId: number;
  tab: 'calendar' | 'missing' | 'swaps';
};

function shortDate(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

/** KEH-L27 Libur Cabang: kalender, belum memilih, laporan tukar; ubah langsung, cabut, minta masuk. */
export function BranchDaysOffScreen(props: Props) {
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<{ person: Person; date: string } | null>(null);
  const [mode, setMode] = useState<'menu' | 'change' | 'revoke'>('menu');
  const [step, setStep] = useState(1);
  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = (patch: Record<string, string | number | null>) => {
    const params = new URLSearchParams();
    const next = { branch: props.branchId, period: props.periodStart, tab: props.tab, ...patch };
    for (const [key, value] of Object.entries(next)) if (value != null) params.set(key, String(value));
    return `/kehadiran/libur?${params}`;
  };

  function open(person: Person, date: string) {
    setTarget({ person, date });
    setMode('menu');
    setStep(1);
    setNewDate('');
    setReason('');
    setError(null);
  }

  async function submit(body: Record<string, unknown>, message: string) {
    setBusy(true);
    const result = await postJson('/api/attendance/days-off', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(result.data?.note ? `${message} Catatan: ${String(result.data.note)}.` : message, 'ok');
    setTarget(null);
    router.refresh();
  }

  if (!props.branchId) return <Alert tone="info">Belum ada cabang yang bisa Anda lihat.</Alert>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <Field id="dl-branch" label="Cabang">
          <Select id="dl-branch" value={props.branchId} onChange={(e) => router.push(query({ branch: e.target.value }))}>
            {props.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
        <Field id="dl-period" label="Periode">
          <Select id="dl-period" value={props.periodStart} onChange={(e) => router.push(query({ period: e.target.value }))}>
            {props.periods.map((start) => <option key={start} value={start}>Mulai {shortDate(start)}</option>)}
          </Select>
        </Field>
      </div>
      <TabNav label="Libur Cabang" active={props.tab} tabs={[
        { key: 'calendar', label: 'Kalender', href: query({ tab: 'calendar' }) },
        { key: 'missing', label: `Belum memilih (${props.missing.length})`, href: query({ tab: 'missing' }) },
        { key: 'swaps', label: 'Tukar', href: query({ tab: 'swaps' }) },
      ]} />

      {props.tab === 'calendar' && (
        props.days.every((day) => !day.people.length) && !props.days.some((day) => day.closed)
          ? <Alert tone="info">Belum ada libur yang dipilih pada periode ini.</Alert>
          : (
            <ul className="divide-y divide-line rounded-card border border-line bg-surface">
              {props.days.map((day) => (
                <li key={day.date} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className={`w-28 font-medium ${day.weekend ? 'text-warn-fg' : ''}`}>{shortDate(day.date)}</span>
                  {day.closed && <Badge tone="info">Hari tutup</Badge>}
                  <span className="text-xs text-ink-muted">{day.people.length}/{day.cap}</span>
                  {day.people.length >= day.cap && <Badge tone="warn">Penuh</Badge>}
                  {day.people.map((person) => (
                    <button
                      key={person.pickId}
                      type="button"
                      disabled={!person.editable || !(props.canChange || props.canRevoke || props.canRequestWork)}
                      onClick={() => open(person, day.date)}
                      className="rounded-full border border-line px-2 py-0.5 text-xs enabled:hover:border-brand-600"
                      title={person.origin}
                    >
                      {person.name}{person.work ? ` · ${person.work}` : ''}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          )
      )}

      {props.tab === 'missing' && (
        <DataList
          rows={props.missing}
          rowKey={(row) => row.employeeId}
          empty="Semua orang sudah memilih jatah liburnya."
          columns={[
            { key: 'name', header: 'Nama', primary: true, render: (row) => row.name },
            { key: 'count', header: 'Terisi', render: (row) => `${row.picked} dari ${row.quota}` },
            { key: 'mark', header: 'Tanda tidak memilih', render: (row) => (row.marked ? <Badge tone="warn">Sudah dicatat</Badge> : '-') },
          ]}
        />
      )}

      {props.tab === 'swaps' && (
        <div className="space-y-3">
          {props.swapCounts.length > 0 && (
            <Card>
              <p className="mb-2 font-semibold">Jumlah tukar per orang</p>
              <p className="text-sm">{props.swapCounts.map((row) => `${row.name}: ${row.count}`).join(' · ')}</p>
            </Card>
          )}
          <DataList
            rows={props.swaps}
            rowKey={(row) => row.id}
            empty="Belum ada tukar pada periode ini."
            columns={[
              { key: 'kind', header: 'Jenis', primary: true, render: (row) => row.kind },
              { key: 'who', header: 'Orang', render: (row) => `${row.from} ↔ ${row.to}` },
              { key: 'dates', header: 'Tanggal', render: (row) => (row.fromDate === row.toDate ? shortDate(row.fromDate) : `${shortDate(row.fromDate)} ↔ ${shortDate(row.toDate)}`) },
            ]}
          />
        </div>
      )}

      <Dialog
        open={target != null}
        onClose={() => setTarget(null)}
        title={target ? `${target.person.name} · libur ${shortDate(target.date)}` : ''}
        footer={mode === 'menu' ? <Button variant="secondary" onClick={() => setTarget(null)}>Tutup</Button> : (
          <>
            {step > 1 ? <Button variant="secondary" onClick={() => setStep(step - 1)}>Kembali</Button> : <Button variant="secondary" onClick={() => setMode('menu')}>Kembali</Button>}
            {mode === 'change' && step < 3 && <Button disabled={step === 1 && !newDate} onClick={() => setStep(step + 1)}>Lanjut</Button>}
            {mode === 'change' && step === 3 && (
              <Button loading={busy} onClick={() => target && submit({ action: 'change', pickId: target.person.pickId, date: newDate, reason }, 'Libur dipindah. Orangnya diberi tahu.')}>Simpan</Button>
            )}
            {mode === 'revoke' && (
              <Button variant="danger" loading={busy} onClick={() => target && submit({ action: 'revoke', pickId: target.person.pickId, reason }, 'Libur dicabut. Orangnya diberi tahu.')}>Cabut libur</Button>
            )}
          </>
        )}
      >
        {target && mode === 'menu' && (
          <div className="space-y-2">
            <p className="text-ink-muted">{target.person.origin}</p>
            <div className="flex flex-wrap gap-2">
              {props.canChange && <Button onClick={() => setMode('change')}>Ubah langsung</Button>}
              {props.canRevoke && <Button variant="secondary" onClick={() => setMode('revoke')}>Cabut</Button>}
              {props.canRequestWork && !target.person.work && (
                <Link href={`/kehadiran/minta-masuk?branch=${props.branchId}&pick=${target.person.pickId}`} className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm">
                  Minta masuk
                </Link>
              )}
            </div>
          </div>
        )}
        {mode === 'change' && step === 1 && (
          <Field id="dl-date" label="Tanggal libur baru" hint="Untuk keadaan mendadak. Hanya diperiksa batas libur bersamaan per cabang.">
            <Input id="dl-date" type="date" min={props.today} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
          </Field>
        )}
        {mode === 'change' && step === 2 && <Field id="dl-reason" label="Alasan"><Textarea id="dl-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
        {mode === 'change' && step === 3 && target && (
          <div className="space-y-2">
            <p>Libur <b>{target.person.name}</b> pindah dari <b>{shortDate(target.date)}</b> ke <b>{newDate ? shortDate(newDate) : '-'}</b>.</p>
            <p className="text-ink-muted">Orangnya diberi tahu dan perubahan tercatat. Tidak berakibat apa pun baginya.</p>
          </div>
        )}
        {mode === 'revoke' && (
          <div className="space-y-2">
            <Field id="dl-revoke" label="Alasan mencabut"><Textarea id="dl-revoke" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            <p className="text-ink-muted">Status menjadi Dicabut; tidak dihapus. Orangnya bisa memilih lagi lewat jalur terlambat.</p>
          </div>
        )}
        {error && <div className="mt-3"><Alert tone="danger">{error}</Alert></div>}
      </Dialog>
    </div>
  );
}
