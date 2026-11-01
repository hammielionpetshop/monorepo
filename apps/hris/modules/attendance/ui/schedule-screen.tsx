'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { WeekTable } from '@/components/ui/week-table';
import { postJson } from '@/lib/post-json';
import { addDays } from '../rules/schedule';

type Cell = { date: string; shiftId: number | null; shiftName: string | null; hours: string | null; source: string; closed: boolean };
type Row = { employeeId: number; name: string; cells: Cell[] };
type Target = { row: Row; cell: Cell };

export function ScheduleScreen(props: {
  branches: { id: number; name: string }[]; branchId: number | null; week: string; today: string; rows: Row[]; dates: string[];
  shifts: { id: number; name: string }[]; groups: { id: number; name: string; memberNames: string[] }[];
  canUpdate: boolean; needsInitialGroups: boolean; candidates: { employeeId: number; name: string }[]; selfId: number;
}) {
  const { branches, branchId, week, today, rows, dates, shifts, groups, canUpdate, needsInitialGroups, candidates, selfId } = props;
  const router = useRouter();
  const toast = useToast();
  const [target, setTarget] = useState<Target | null>(null);
  const [shiftId, setShiftId] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [membership, setMembership] = useState<Record<number, 0 | 1>>({});
  const [groupError, setGroupError] = useState<string | null>(null);

  const go = (branch: number | null, nextWeek: string) => router.push(`/kehadiran/jadwal?branch=${branch ?? ''}&week=${nextWeek}`);
  const unset = target?.cell.shiftId == null;

  async function save() {
    if (!target || !shiftId) return setError('Pilih shift dulu.');
    setBusy(true);
    const result = await postJson('/api/attendance', unset
      ? { kind: 'assign', employeeId: target.row.employeeId, shiftId: Number(shiftId), week }
      : { kind: 'day_change', employeeId: target.row.employeeId, date: target.cell.date, shiftId: Number(shiftId), reason });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Jadwal tersimpan. Orangnya diberi tahu.', 'ok');
    setTarget(null);
    router.refresh();
  }

  async function saveGroups() {
    const ids = (group: 0 | 1) => candidates.filter((person) => (membership[person.employeeId] ?? 0) === group).map((person) => person.employeeId);
    setBusy(true);
    const result = await postJson('/api/attendance', { kind: 'initial_groups', branchId, first: ids(0), second: ids(1) });
    setBusy(false);
    if (!result.ok) return setGroupError(result.error ?? 'Gagal menyimpan.');
    toast('Kelompok tersimpan. Mesin menggilir mulai Senin depan.', 'ok');
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-48">
          <Field id="sch-branch" label="Cabang">
            <Select id="sch-branch" value={branchId ?? ''} onChange={(e) => go(Number(e.target.value), week)}>
              {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>
          </Field>
        </div>
        <Button variant="secondary" onClick={() => go(branchId, addDays(week, -7))}>Minggu lalu</Button>
        <Button variant="secondary" onClick={() => go(branchId, addDays(week, 7))}>Minggu depan</Button>
      </div>

      {shifts.length === 0 && <Alert tone="warn">Cabang ini belum punya shift aktif. Isi dulu di Jam Kerja Cabang.</Alert>}
      {shifts.length === 1 && <p className="text-sm text-ink-muted">Satu shift, tidak digilir.</p>}
      {shifts.length > 2 && <p className="text-sm text-ink-muted">Lebih dari dua shift: tidak digilir mesin, jadwal diisi tangan tiap minggu.</p>}

      <WeekTable
        dates={dates}
        rows={rows}
        rowKey={(row) => row.employeeId}
        rowLabel={(row) => row.name}
        renderCell={(row, date, index) => {
          const cell = row.cells[index];
          const editable = canUpdate && shifts.length > 0 && !cell.closed && row.employeeId !== selfId && date >= today;
          const body = (
            <>
              {cell.closed ? <Badge tone="info">Hari tutup</Badge> : cell.shiftName
                ? <><span className="block font-medium">{cell.shiftName}{cell.source === 'DAY_CHANGE' ? ' *' : ''}</span><span className="block text-xs text-ink-muted">{cell.hours ?? 'Jam belum berlaku'}</span></>
                : <span className="text-xs text-warn-fg">Shift belum ditentukan</span>}
            </>
          );
          return editable ? (
            <button
              type="button"
              className="w-full rounded p-1 text-left hover:bg-canvas"
              onClick={() => { setTarget({ row, cell }); setShiftId(''); setReason(''); setError(null); }}
            >{body}</button>
          ) : <div className="p-1">{body}</div>;
        }}
      />
      <p className="text-xs text-ink-muted">* diubah khusus hari itu.</p>

      {groups.length > 0 && (
        <Card>
          <h2 className="font-semibold">Kelompok</h2>
          <p className="mb-2 text-sm text-ink-muted">Digilir otomatis tiap Senin.</p>
          {groups.map((group) => (
            <p key={group.id} className="text-sm"><b>{group.name}:</b> {group.memberNames.join(', ') || '-'}</p>
          ))}
        </Card>
      )}

      {needsInitialGroups && canUpdate && (
        <Card>
          <h2 className="font-semibold">Isi giliran awal (sekali)</h2>
          <p className="mb-3 text-sm text-ink-muted">
            Minggu ini Kelompok A memakai {shifts[0].name}, Kelompok B memakai {shifts[1].name}. Sesudah disimpan, mesin yang menggilir tiap Senin.
          </p>
          <ul className="space-y-2">
            {candidates.map((person) => (
              <li key={person.employeeId} className="flex items-center justify-between gap-2 text-sm">
                <span>{person.name}</span>
                <Select
                  aria-label={`Kelompok ${person.name}`}
                  className="w-40"
                  value={membership[person.employeeId] ?? 0}
                  onChange={(e) => setMembership({ ...membership, [person.employeeId]: Number(e.target.value) as 0 | 1 })}
                >
                  <option value={0}>Kelompok A</option>
                  <option value={1}>Kelompok B</option>
                </Select>
              </li>
            ))}
          </ul>
          {groupError && <div className="mt-3"><Alert tone="danger">{groupError}</Alert></div>}
          <div className="mt-3"><Button loading={busy} onClick={saveGroups}>Simpan kelompok</Button></div>
        </Card>
      )}

      <Dialog
        open={target != null}
        onClose={() => setTarget(null)}
        title={target ? `${target.row.name} · ${unset ? `minggu ${week}` : target.cell.date}` : ''}
        footer={<><Button variant="secondary" onClick={() => setTarget(null)}>Kembali</Button><Button loading={busy} onClick={save}>Simpan</Button></>}
      >
        <div className="space-y-3">
          {unset && <p className="text-sm text-ink-muted">Shift ini berlaku untuk minggu itu. Di cabang berkelompok, orangnya ikut kelompok yang memakai shift ini.</p>}
          <Field id="sch-shift" label="Shift">
            <Select id="sch-shift" value={shiftId} onChange={(e) => setShiftId(e.target.value)}>
              <option value="">Pilih shift</option>
              {shifts.map((shift) => <option key={shift.id} value={shift.id}>{shift.name}</option>)}
            </Select>
          </Field>
          {!unset && <Field id="sch-reason" label="Alasan"><Textarea id="sch-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>}
          {error && <Alert tone="danger">{error}</Alert>}
        </div>
      </Dialog>
    </div>
  );
}
