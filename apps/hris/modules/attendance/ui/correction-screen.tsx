'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { HoldButton } from '@/components/ui/hold-button';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { postJson } from '@/lib/post-json';
import { recomputeMinutes, wibLocal } from '../rules/review';
import { addDays } from '../rules/schedule';
import { TabNav } from './tab-nav';

type ShiftOption = { id: number; name: string; hours: string; startTime: string; endTime: string };
type Person = {
  employeeId: number; name: string; canCorrect: boolean; baseCorrectionId: number | null; defaultBranchId: number; lateApplies: boolean;
  current: { branchId: number | null; shiftId: number | null; inAt: string; outAt: string; summary: string };
};
type FixData = {
  mode: 'one' | 'many'; date: string; today: string; branchId: number | null; employeeId: number | null;
  branches: { id: number; name: string }[]; candidates: { id: number; name: string }[];
  shiftOptions: Record<string, ShiftOption[]>; people: Person[]; reasons: { value: string; label: string }[];
};
type HistoryRow = {
  id: number; employeeId: number; name: string; workDate: string; before: string; after: string; lateMinutes: number | null;
  reason: string; note: string; reversesId: number | null; batch: boolean; by: string; at: string; canReverse: boolean;
};
type HistoryData = {
  period: { start: string; end: string }; periods: { start: string; end: string }[]; branches: { id: number; name: string }[];
  branchId: number | null; q: string; rows: HistoryRow[];
};
type Value = { branchId: number; shiftId: number | null; inAt: string; outAt: string };

const STEPS = ['Pilih', 'Isi nilai baru', 'Alasan', 'Periksa'];
const HOLD_ABOVE = 5;
const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });
const clockOf = (local: string) => (local ? local.slice(11, 16).replace(':', '.') : '?');

/** KEH-L13 Koreksi Absen: satu-satunya pintu membetulkan absen. Tab Riwayat untuk yang hanya melihat. */
export function CorrectionScreen({ tab, canCreate, fix, history }: {
  tab: 'fix' | 'history'; canCreate: boolean; fix: FixData | null; history: HistoryData | null;
}) {
  return (
    <div className="space-y-4">
      <TabNav
        label="Tab Koreksi Absen"
        active={tab}
        tabs={[
          ...(canCreate ? [{ key: 'fix', label: 'Koreksi', href: '/kehadiran/koreksi' }] : []),
          ...(history ? [{ key: 'history', label: 'Riwayat koreksi', href: '/kehadiran/koreksi?tab=history' }] : []),
        ]}
      />
      {tab === 'fix' && fix && <FixPanel key={[fix.mode, fix.date, fix.employeeId, fix.branchId].join('|')} data={fix} />}
      {tab === 'history' && history && <HistoryPanel data={history} />}
    </div>
  );
}

function FixPanel({ data }: { data: FixData }) {
  const router = useRouter();
  const toast = useToast();
  const options = (branchId: number) => data.shiftOptions[String(branchId)] ?? [];
  const [step, setStep] = useState(data.people.length ? 2 : 1);
  // Isian awal = keadaan berlaku; panel dibuat ulang (key) tiap pilihan orang/cabang/tanggal berubah.
  const [values, setValues] = useState<Record<number, Value>>(() => Object.fromEntries(data.people.map((person) => {
    const branchId = person.defaultBranchId;
    const list = options(branchId);
    const shiftId = list.some((shift) => shift.id === person.current.shiftId) ? person.current.shiftId : list[0]?.id ?? null;
    return [person.employeeId, { branchId, shiftId, inAt: person.current.inAt, outAt: person.current.outAt }];
  })));
  const [selected, setSelected] = useState<Set<number>>(new Set(data.mode === 'one' ? data.people.map((person) => person.employeeId) : []));
  const [allIn, setAllIn] = useState('');
  const [allOut, setAllOut] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: Partial<{ mode: string; date: string; employee: string; branch: string }>) => {
    const params = new URLSearchParams({ mode: next.mode ?? data.mode, date: next.date ?? data.date });
    const employee = next.employee ?? (data.employeeId ? String(data.employeeId) : '');
    const branch = next.branch ?? (data.branchId ? String(data.branchId) : '');
    if ((next.mode ?? data.mode) === 'one' && employee) params.set('employee', employee);
    if ((next.mode ?? data.mode) === 'many' && branch) params.set('branch', branch);
    router.push(`/kehadiran/koreksi?${params}`);
  };

  const chosen = data.people.filter((person) => selected.has(person.employeeId));
  const blocked = chosen.filter((person) => !person.canCorrect);
  const set = (employeeId: number, patch: Partial<Value>) => setValues((prev) => ({ ...prev, [employeeId]: { ...prev[employeeId], ...patch } }));
  const minLocal = `${data.date}T00:00`;
  const maxLocal = `${addDays(data.date, 1)}T12:00`;

  const preview = (person: Person) => {
    const value = values[person.employeeId];
    const shift = options(value.branchId).find((row) => row.id === value.shiftId) ?? null;
    const inAt = wibLocal(value.inAt);
    const outAt = value.outAt ? wibLocal(value.outAt) : null;
    const minutes = inAt ? recomputeMinutes(data.date, shift, { branchId: value.branchId, shiftId: shift?.id ?? null, shiftVersionId: null, inAt, outAt }, person.lateApplies) : null;
    const branch = data.branches.find((row) => row.id === value.branchId)?.name ?? '-';
    return { after: `${branch} · ${shift?.name ?? 'Belum ditentukan'} · ${clockOf(value.inAt)}–${clockOf(value.outAt)}`, minutes };
  };

  async function save() {
    setBusy(true);
    const result = await postJson('/api/attendance/review', {
      kind: 'correct', workDate: data.date, batchBranchId: data.mode === 'many' ? data.branchId : null, reasonCode, note,
      items: chosen.map((person) => {
        const value = values[person.employeeId];
        return {
          employeeId: person.employeeId, branchId: value.branchId, shiftId: value.shiftId, inAt: value.inAt,
          outAt: value.outAt || null, baseCorrectionId: person.baseCorrectionId,
        };
      }),
    });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast(String(result.data?.message ?? 'Koreksi tersimpan.'), 'ok');
    router.push('/kehadiran/koreksi?tab=history');
  }

  const stepError = (): string | null => {
    if (step === 2) {
      if (!chosen.length) return 'Pilih paling sedikit satu orang.';
      if (blocked.length) return `${blocked.map((person) => person.name).join(', ')}: absen Anda sendiri dikoreksi orang lain yang berhak.`;
      const empty = chosen.find((person) => !values[person.employeeId].inAt);
      if (empty) return `Isi jam masuk ${empty.name}.`;
    }
    if (step === 3 && !reasonCode) return 'Pilih alasan.';
    return null;
  };

  return (
    <div className="space-y-4">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((label, index) => (
          <li key={label} className={`rounded-full px-3 py-1 ${step === index + 1 ? 'bg-brand-600 text-white' : 'bg-canvas text-ink-muted'}`}>{index + 1}. {label}</li>
        ))}
      </ol>

      {step === 1 || step === 2 ? (
        <Card className="grid gap-3 sm:grid-cols-3">
          <Field id="fix-mode" label="Koreksi untuk">
            <Select id="fix-mode" value={data.mode} onChange={(event) => go({ mode: event.target.value })}>
              <option value="one">Satu orang</option>
              <option value="many">Banyak orang (satu cabang)</option>
            </Select>
          </Field>
          <Field id="fix-date" label="Tanggal hari kerja">
            <Input id="fix-date" type="date" max={data.today} value={data.date} onChange={(event) => event.target.value && go({ date: event.target.value })} />
          </Field>
          {data.mode === 'one' ? (
            <Field id="fix-person" label="Orang">
              <Select id="fix-person" value={data.employeeId ?? ''} onChange={(event) => go({ employee: event.target.value })}>
                <option value="">Pilih orang</option>
                {data.candidates.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </Select>
            </Field>
          ) : (
            <Field id="fix-branch" label="Cabang">
              <Select id="fix-branch" value={data.branchId ?? ''} onChange={(event) => go({ branch: event.target.value })}>
                <option value="">Pilih cabang</option>
                {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </Select>
            </Field>
          )}
        </Card>
      ) : null}

      {step === 1 && !data.people.length && <EmptyState title="Pilih orang atau cabang dan tanggal untuk mulai." />}

      {step === 2 && (
        <div className="space-y-3">
          {data.mode === 'many' && (
            <Card className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" onClick={() => setSelected(new Set(data.people.filter((person) => person.current.inAt).map((person) => person.employeeId)))}>
                  Semua yang absen hari itu
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Kosongkan pilihan</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field id="all-in" label="Jam masuk untuk semua"><Input id="all-in" type="datetime-local" min={minLocal} max={maxLocal} value={allIn} onChange={(event) => setAllIn(event.target.value)} /></Field>
                <Field id="all-out" label="Jam pulang untuk semua"><Input id="all-out" type="datetime-local" min={minLocal} max={maxLocal} value={allOut} onChange={(event) => setAllOut(event.target.value)} /></Field>
                <div className="flex items-end">
                  <Button variant="secondary" onClick={() => chosen.forEach((person) => set(person.employeeId, { ...(allIn ? { inAt: allIn } : {}), ...(allOut ? { outAt: allOut } : {}) }))}>
                    Terapkan ke yang dipilih
                  </Button>
                </div>
              </div>
            </Card>
          )}
          {!data.people.length && <EmptyState title="Tidak ada orang di pilihan ini." />}
          <ul className="space-y-2">
            {data.people.map((person) => {
              const value = values[person.employeeId];
              const checked = selected.has(person.employeeId);
              return (
                <li key={person.employeeId}>
                  <Card className="space-y-3">
                    <label className="flex items-center gap-2 font-medium">
                      {data.mode === 'many' && (
                        <input type="checkbox" checked={checked} disabled={!person.canCorrect} onChange={(event) => setSelected((prev) => {
                          const next = new Set(prev);
                          if (event.target.checked) next.add(person.employeeId); else next.delete(person.employeeId);
                          return next;
                        })} />
                      )}
                      {person.name}
                      {!person.current.inAt && <Badge tone="warn">Tanpa absen</Badge>}
                    </label>
                    <p className="text-sm text-ink-muted">Sekarang: {person.current.summary}</p>
                    {!person.canCorrect && <Alert tone="warn">Absen Anda sendiri dikoreksi orang lain yang berhak.</Alert>}
                    {checked && person.canCorrect && (
                      <div className="grid gap-3 sm:grid-cols-4">
                        <Field id={`b-${person.employeeId}`} label="Cabang hari itu">
                          <Select id={`b-${person.employeeId}`} value={value.branchId} disabled={data.mode === 'many'} onChange={(event) => {
                            const branchId = Number(event.target.value);
                            const currentName = options(value.branchId).find((row) => row.id === value.shiftId)?.name.trim().toLowerCase();
                            const list = options(branchId);
                            set(person.employeeId, { branchId, shiftId: list.find((row) => row.name.trim().toLowerCase() === currentName)?.id ?? list[0]?.id ?? null });
                          }}>
                            {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                          </Select>
                        </Field>
                        <Field id={`s-${person.employeeId}`} label="Shift">
                          <Select id={`s-${person.employeeId}`} value={value.shiftId ?? ''} onChange={(event) => set(person.employeeId, { shiftId: event.target.value ? Number(event.target.value) : null })}>
                            {!options(value.branchId).length && <option value="">Cabang ini belum punya shift</option>}
                            {options(value.branchId).map((shift) => <option key={shift.id} value={shift.id}>{shift.name} ({shift.hours})</option>)}
                          </Select>
                        </Field>
                        <Field id={`i-${person.employeeId}`} label={person.current.inAt ? 'Jam masuk' : 'Tambah absen: jam masuk'}>
                          <Input id={`i-${person.employeeId}`} type="datetime-local" min={minLocal} max={maxLocal} value={value.inAt} onChange={(event) => set(person.employeeId, { inAt: event.target.value })} />
                        </Field>
                        <Field id={`o-${person.employeeId}`} label="Jam pulang" hint="Kosongkan bila belum pulang.">
                          <Input id={`o-${person.employeeId}`} type="datetime-local" min={minLocal} max={maxLocal} value={value.outAt} onChange={(event) => set(person.employeeId, { outAt: event.target.value })} />
                        </Field>
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {step === 3 && (
        <Card className="space-y-3">
          <Field id="fix-reason" label="Alasan">
            <Select id="fix-reason" value={reasonCode} onChange={(event) => setReasonCode(event.target.value)}>
              <option value="">Pilih alasan</option>
              {data.reasons.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
            </Select>
          </Field>
          <Field id="fix-note" label="Keterangan singkat"><Textarea id="fix-note" value={note} onChange={(event) => setNote(event.target.value)} /></Field>
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-2">
          <Alert>Catatan asli tidak ditimpa. Telat dan pulang cepat dihitung ulang sistem saat disimpan. Orangnya diberi tahu.</Alert>
          <DataList
            rows={chosen}
            rowKey={(person) => person.employeeId}
            columns={[
              { key: 'name', header: 'Orang', primary: true, render: (person) => person.name },
              { key: 'before', header: 'Lama', render: (person) => person.current.summary },
              { key: 'after', header: 'Baru', render: (person) => preview(person).after },
              {
                key: 'late', header: 'Hitung ulang', render: (person) => {
                  const minutes = preview(person).minutes;
                  return minutes ? `Telat ${minutes.lateMinutes ?? '-'} mnt · pulang cepat ${minutes.earlyLeaveMinutes ?? '-'} mnt` : '-';
                },
              },
            ]}
          />
        </div>
      )}

      {error && <Alert tone="danger">{error}</Alert>}

      {step > 1 && (
        <div className="flex flex-wrap gap-2">
          {step > 2 && <Button variant="secondary" onClick={() => { setError(null); setStep(step - 1); }}>Kembali</Button>}
          {step < 4 ? (
            <Button onClick={() => {
              const problem = stepError();
              setError(problem);
              if (!problem) setStep(step + 1);
            }}>Lanjut</Button>
          ) : chosen.length > HOLD_ABOVE
            ? <HoldButton loading={busy} onClick={save}>Simpan koreksi ({chosen.length} orang)</HoldButton>
            : <Button loading={busy} onClick={save}>Simpan koreksi</Button>}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ data }: { data: HistoryData }) {
  const router = useRouter();
  const toast = useToast();
  const [reversing, setReversing] = useState<HistoryRow | null>(null);
  const [reason, setReason] = useState('');
  const [q, setQ] = useState(data.q);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const go = (next: Partial<{ period: string; branch: string; q: string }>) => {
    const params = new URLSearchParams({ tab: 'history', period: next.period ?? data.period.start });
    const branch = next.branch ?? (data.branchId ? String(data.branchId) : '');
    if (branch) params.set('branch', branch);
    const query = next.q ?? data.q;
    if (query) params.set('q', query);
    router.push(`/kehadiran/koreksi?${params}`);
  };

  async function reverse() {
    if (!reversing) return;
    setBusy(true);
    const result = await postJson('/api/attendance/review', { kind: 'reverse', correctionId: reversing.id, reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal membalik.');
    toast(String(result.data?.message ?? 'Koreksi dibalik.'), 'ok');
    setReversing(null);
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Field id="h-period" label="Periode">
          <Select id="h-period" value={data.period.start} onChange={(event) => go({ period: event.target.value })}>
            {data.periods.map((period) => <option key={period.start} value={period.start}>{period.start} s.d. {period.end}</option>)}
          </Select>
        </Field>
        <Field id="h-branch" label="Cabang">
          <Select id="h-branch" value={data.branchId ?? ''} onChange={(event) => go({ branch: event.target.value })}>
            <option value="">Semua cabang</option>
            {data.branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
        <form onSubmit={(event) => { event.preventDefault(); go({ q }); }}>
          <Field id="h-q" label="Cari nama"><Input id="h-q" value={q} onChange={(event) => setQ(event.target.value)} /></Field>
        </form>
      </div>
      <DataList
        rows={data.rows}
        rowKey={(row) => row.id}
        empty="Belum ada koreksi di periode ini."
        columns={[
          { key: 'name', header: 'Orang', primary: true, render: (row) => <Link className="text-brand-700" href={`/kehadiran/catatan-hari?employee=${row.employeeId}&date=${row.workDate}`}>{row.name} · {row.workDate}</Link> },
          { key: 'before', header: 'Lama', render: (row) => row.before },
          { key: 'after', header: 'Baru', render: (row) => <>{row.after}{row.lateMinutes != null && <> · telat {row.lateMinutes} mnt</>}</> },
          {
            key: 'reason', header: 'Alasan', render: (row) => (
              <span>{row.reversesId ? <Badge tone="info">Membalik koreksi</Badge> : row.reason}{row.batch && <> <Badge>Banyak orang</Badge></>} {row.note}</span>
            ),
          },
          { key: 'by', header: 'Oleh', render: (row) => `${row.by}, ${when(row.at)}` },
          {
            key: 'action', header: '', render: (row) => (row.canReverse
              ? <Button size="sm" variant="ghost" onClick={() => { setReversing(row); setReason(''); setError(null); }}>Balik</Button> : null),
          },
        ]}
      />
      <Dialog
        open={reversing != null}
        onClose={() => setReversing(null)}
        title={reversing ? `Balik koreksi ${reversing.name} ${reversing.workDate}` : ''}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setReversing(null)}>Kembali</Button>
            <Button loading={busy} onClick={reverse}>Balik koreksi</Button>
          </>
        )}
      >
        <div className="space-y-3 text-sm">
          <p>Nilai kembali ke: <b>{reversing?.before}</b>. Keduanya tetap tampil di riwayat.</p>
          <Field id="rev-reason" label="Alasan"><Textarea id="rev-reason" value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
