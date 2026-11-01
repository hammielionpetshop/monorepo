'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { addDays, formatLongDate } from '../rules/dates';
import { GENDERS, GENDER_LABELS, type PersonField } from '../rules/fields';
import {
  CHANGE_KINDS, PLACEMENT_KIND_LABELS, WORK_STATUSES, WORK_STATUS_LABELS, type ChangeKind, type WorkStatus,
} from '../rules/history';
import type { EmployeeDetail } from '../server/employees';
import { ActiveBadge, HoldButton, LongDate, StepLabel, WorkStatusBadge, useMutation } from './shared';

const REASON_LABELS = { RESIGNED: 'Berhenti', DISMISSED: 'Diberhentikan', OTHER: 'Lainnya' } as const;
const NOTICE_LABELS = { WITH_NOTICE: 'Dengan pemberitahuan sebulan', WITHOUT_NOTICE: 'Tanpa pemberitahuan sebulan' } as const;
const PERMIT_LABELS = { DRIVE: 'Boleh menyetir', ASSIST: 'Boleh ikut sebagai kenek' } as const;

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3 py-1.5 text-sm">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right">{children ?? '—'}</dd>
    </div>
  );
}

/** KAR-L21 Halaman orang. Tombol tanpa hak tidak tampil; server tetap memeriksa (KAR-72). */
export function EmployeeDetailScreen({ detail, accountSlot }: { detail: EmployeeDetail; accountSlot?: React.ReactNode }) {
  const { summary, rights, isSelf } = detail;
  const highRightsLocked = summary.positionHighRights && !rights.touchHighRights;
  const path = `/api/employees/${summary.id}`;
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold sm:text-2xl">{summary.name}</h1>
            <p className="text-sm text-ink-muted">{summary.code} · {summary.positionName} · {summary.branchName}</p>
          </div>
          <div className="flex flex-wrap gap-1">
            <WorkStatusBadge status={summary.workStatus} />
            <ActiveBadge active={summary.activeToday} />
            {summary.pendingStatus && (
              <Badge tone="warn">
                {summary.pendingStatus.kind === 'DEACTIVATE' ? 'Nonaktif mulai ' : 'Aktif lagi mulai '}
                {formatLongDate(summary.pendingStatus.effectiveOn)}
              </Badge>
            )}
          </div>
        </div>
        {isSelf && <p className="mt-3 text-sm text-ink-muted">Ini halaman Anda sendiri: penempatan, status, dan izin diubah orang lain yang berhak.</p>}
        {highRightsLocked && !isSelf && (
          <p className="mt-3 text-sm text-ink-muted">Pemegang jabatan berhak tinggi: penempatan dan statusnya hanya diubah Pemilik dan GM.</p>
        )}
      </Card>

      {/* Isi selebar layar: kartu dibagi dua kolom di layar sangat lebar supaya label dan nilai tidak berjauhan. */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        {detail.person && <PersonCard detail={detail} path={path} />}
        {detail.person && <PlacementCard detail={detail} path={path} canRecord={rights.recordPlacement && !highRightsLocked} />}
        {detail.person && <StatusCard detail={detail} path={path} canChange={rights.activation && !highRightsLocked} />}
        <PermitCard detail={detail} path={path} />
        {/* Kartu Akun milik modul accounts (L2d), disisipkan halaman. */}
        {detail.person && accountSlot}
      </div>
    </div>
  );
}

// ---------- Data diri ----------

type PersonForm = Record<PersonField, string>;

const PERSON_LABELS: Record<PersonField, string> = {
  name: 'Nama', phone: 'Nomor HP', email: 'Email', birthDate: 'Tanggal lahir', gender: 'Jenis kelamin',
  address: 'Alamat', emergencyContactName: 'Kontak darurat (nama)', emergencyContactPhone: 'Kontak darurat (HP)',
  birthPlace: 'Tempat lahir', religion: 'Agama', maritalStatus: 'Status nikah', dependents: 'Jumlah tanggungan',
  education: 'Pendidikan', bankName: 'Bank', bankAccountNumber: 'Nomor rekening', bankAccountHolder: 'Nama pemilik rekening',
};

function PersonCard({ detail, path }: { detail: EmployeeDetail; path: string }) {
  const person = detail.person!;
  const [form, setForm] = useState<PersonForm | null>(null);
  const [reason, setReason] = useState('');
  const { busy, error, setError, send } = useMutation(path);
  const canEdit = detail.rights.update && !detail.isSelf;

  function open() {
    setError(null);
    setReason('');
    setForm(Object.fromEntries(Object.keys(PERSON_LABELS).map((key) => {
      const value = person[key as PersonField];
      return [key, value == null ? '' : String(value)];
    })) as PersonForm);
  }

  async function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!form) return;
    const changes = Object.fromEntries(Object.entries(form)
      .filter(([key, value]) => (person[key as PersonField] == null ? '' : String(person[key as PersonField])) !== value)
      .map(([key, value]) => [key, key === 'dependents' ? (value === '' ? null : Number(value)) : value || null]));
    if (!Object.keys(changes).length) return setError('Tidak ada isian yang berubah.');
    if (await send({ kind: 'update', fields: changes, reason: reason || null }, 'Data orang tersimpan dan tercatat.')) setForm(null);
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Data diri dan identitas</h2>
        {canEdit && <Button size="sm" variant="secondary" onClick={open}>Ubah data</Button>}
      </div>
      <dl className="divide-y divide-line">
        <Row label="Tanggal bergabung"><LongDate value={person.joinedOn} /></Row>
        <Row label="Nomor HP">{person.phone}</Row>
        <Row label="Email">{person.email}</Row>
        <Row label="Tanggal lahir"><LongDate value={person.birthDate} /></Row>
        <Row label="Jenis kelamin">{person.gender ? GENDER_LABELS[person.gender] : null}</Row>
        <Row label="Alamat">{person.address}</Row>
        <Row label="Kontak darurat">{person.emergencyContactName ? `${person.emergencyContactName} (${person.emergencyContactPhone ?? '—'})` : null}</Row>
        <Row label="Rekening">{person.bankAccountNumber ? `${person.bankName ?? ''} ${person.bankAccountNumber} a.n. ${person.bankAccountHolder ?? '—'}` : <Badge tone="warn">Belum ada rekening</Badge>}</Row>
        <Row label="Data diri lain">
          {[person.birthPlace, person.religion, person.maritalStatus, person.dependents != null ? `${person.dependents} tanggungan` : null, person.education]
            .filter(Boolean).join(' · ') || null}
        </Row>
        {person.source !== 'HRIS' && <Row label="Asal data">{person.source === 'LEGACY' ? 'Bawaan sistem lama' : 'Fixture uji'}</Row>}
      </dl>

      <Dialog open={!!form} onClose={() => setForm(null)} title="Ubah data orang">
        {form && (
          <form id="person-form" onSubmit={submit} className="space-y-3">
            {(Object.keys(PERSON_LABELS) as PersonField[]).map((key) => (
              <Field key={key} id={`p-${key}`} label={PERSON_LABELS[key]}>
                {key === 'gender' ? (
                  <Select id={`p-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}>
                    <option value="">Belum diisi</option>
                    {GENDERS.map((g) => <option key={g} value={g}>{GENDER_LABELS[g]}</option>)}
                  </Select>
                ) : key === 'address' ? (
                  <Textarea id={`p-${key}`} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                ) : (
                  <Input
                    id={`p-${key}`}
                    type={key === 'birthDate' ? 'date' : key === 'dependents' ? 'number' : 'text'}
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  />
                )}
              </Field>
            ))}
            <Field id="p-reason" label="Keterangan (boleh kosong)"><Input id="p-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>Kembali</Button>
              <Button type="submit" loading={busy}>Simpan</Button>
            </div>
          </form>
        )}
      </Dialog>
    </Card>
  );
}

// ---------- Penempatan ----------

type PlacementDraft = { step: number; kind: ChangeKind | ''; value: string; effectiveFrom: string; reason: string };

function PlacementCard({ detail, path, canRecord }: { detail: EmployeeDetail; path: string; canRecord: boolean }) {
  const { summary, org, today } = detail;
  const [draft, setDraft] = useState<PlacementDraft | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const { busy, error, setError, send } = useMutation(path);
  const branches = org.branches.filter((b) => b.active);
  const positions = org.positions.filter((p) => p.active && (!p.highRights || detail.rights.touchHighRights));

  const valueLabel = (kind: ChangeKind | '', value: string) => kind === 'BRANCH'
    ? org.branches.find((b) => String(b.id) === value)?.name
    : kind === 'POSITION' ? org.positions.find((p) => String(p.id) === value)?.name
      : kind === 'WORK_STATUS' && value ? WORK_STATUS_LABELS[value as WorkStatus] : '';
  const currentLabel = (kind: ChangeKind | '') => kind === 'BRANCH' ? summary.branchName
    : kind === 'POSITION' ? summary.positionName : kind === 'WORK_STATUS' ? WORK_STATUS_LABELS[summary.workStatus] : '';

  function step(next: number) {
    if (!draft) return;
    setError(null);
    if (next === 2 && !draft.kind) return setError('Pilih jenis perubahan.');
    if (next === 3 && !draft.value) return setError('Pilih nilai baru.');
    if (next === 4 && (!draft.effectiveFrom || !draft.reason.trim())) return setError('Tanggal berlaku dan alasan wajib diisi.');
    setDraft({ ...draft, step: next });
  }

  async function save() {
    if (!draft) return;
    const value = draft.kind === 'WORK_STATUS' ? draft.value : Number(draft.value);
    if (await send({ kind: 'placement', change: draft.kind, value, effectiveFrom: draft.effectiveFrom, reason: draft.reason },
      'Catatan penempatan tersimpan.')) setDraft(null);
  }

  async function cancel() {
    if (cancelId == null) return;
    if (await send({ kind: 'cancel_placement', placementId: cancelId, reason: cancelReason }, 'Catatan penempatan dibatalkan.')) setCancelId(null);
  }

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Penempatan</h2>
        {canRecord && !detail.isSelf && (
          <Button size="sm" variant="secondary" onClick={() => { setError(null); setDraft({ step: 1, kind: '', value: '', effectiveFrom: today, reason: '' }); }}>
            Catat perubahan
          </Button>
        )}
      </div>
      <ol className="divide-y divide-line text-sm">
        {[...detail.placements].reverse().map((p) => {
          const future = !p.cancelledAt && p.effectiveFrom > today;
          return (
            <li key={p.id} className={p.cancelledAt ? 'py-2 text-ink-muted line-through' : 'py-2'}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{PLACEMENT_KIND_LABELS[p.kind]} · <LongDate value={p.effectiveFrom} /></span>
                <span className="flex gap-1">
                  {future && <Badge tone="warn">Belum berlaku</Badge>}
                  {p.cancelledAt && <Badge>Dibatalkan</Badge>}
                  {future && canRecord && !detail.isSelf && p.kind !== 'INITIAL' && !p.linkedToPromotion && (
                    <Button size="sm" variant="ghost" onClick={() => { setError(null); setCancelReason(''); setCancelId(p.id); }}>Batalkan</Button>
                  )}
                </span>
              </div>
              <p>{p.branchName} · {p.positionName} · {WORK_STATUS_LABELS[p.workStatus]}</p>
              {p.reason && <p className="text-ink-muted">{p.reason}</p>}
              {p.cancelReason && <p className="text-ink-muted no-underline">Dibatalkan: {p.cancelReason}</p>}
            </li>
          );
        })}
      </ol>

      <Dialog open={!!draft} onClose={() => setDraft(null)} title="Catat perubahan penempatan">
        {draft && (
          <div className="space-y-3">
            {draft.step === 1 && (
              <>
                <StepLabel step={1} total={4} title="Pilih jenis" />
                <div className="grid gap-2">
                  {CHANGE_KINDS.map((kind) => (
                    <label key={kind} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3">
                      <input type="radio" name="kind" checked={draft.kind === kind} onChange={() => setDraft({ ...draft, kind, value: '' })} />
                      {PLACEMENT_KIND_LABELS[kind]}
                    </label>
                  ))}
                </div>
              </>
            )}
            {draft.step === 2 && (
              <>
                <StepLabel step={2} total={4} title="Isi" />
                <p className="text-ink-muted">Sekarang: {currentLabel(draft.kind)}</p>
                <Field id="pl-value" label="Nilai baru" hint={draft.kind === 'WORK_STATUS' ? 'Training menjadi Karyawan lewat Promosi Training.' : undefined}>
                  <Select id="pl-value" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })}>
                    <option value="">Pilih</option>
                    {draft.kind === 'BRANCH' && branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    {draft.kind === 'POSITION' && positions.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.departmentName}</option>)}
                    {draft.kind === 'WORK_STATUS' && WORK_STATUSES.map((s) => <option key={s} value={s}>{WORK_STATUS_LABELS[s]}</option>)}
                  </Select>
                </Field>
              </>
            )}
            {draft.step === 3 && (
              <>
                <StepLabel step={3} total={4} title="Tanggal berlaku dan alasan" />
                <Field id="pl-date" label="Berlaku mulai" hint="Boleh tanggal lalu (membetulkan salah isi) atau tanggal depan.">
                  <Input id="pl-date" type="date" value={draft.effectiveFrom} onChange={(e) => setDraft({ ...draft, effectiveFrom: e.target.value })} />
                </Field>
                <Field id="pl-reason" label="Alasan">
                  <Textarea id="pl-reason" value={draft.reason} onChange={(e) => setDraft({ ...draft, reason: e.target.value })} />
                </Field>
              </>
            )}
            {draft.step === 4 && (
              <>
                <StepLabel step={4} total={4} title="Periksa" />
                <p>
                  {summary.name}: <strong>{PLACEMENT_KIND_LABELS[draft.kind as ChangeKind].toLowerCase()}</strong> menjadi{' '}
                  <strong>{valueLabel(draft.kind, draft.value)}</strong> mulai {formatLongDate(draft.effectiveFrom)}.
                </p>
                {draft.kind === 'BRANCH' && <p className="text-ink-muted">Hak aksesnya atas data cabang lama berhenti di tanggal itu.</p>}
                {draft.kind !== 'BRANCH' && <p className="text-ink-muted">Jabatan dan status kerja memengaruhi perlakuan gaji mulai tanggal itu.</p>}
              </>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => (draft.step === 1 ? setDraft(null) : setDraft({ ...draft, step: draft.step - 1 }))} disabled={busy}>
                Kembali
              </Button>
              {draft.step < 4 ? <Button onClick={() => step(draft.step + 1)}>Lanjut</Button> : <HoldButton onClick={save} loading={busy}>Simpan</HoldButton>}
            </div>
          </div>
        )}
      </Dialog>

      <Dialog open={cancelId != null} onClose={() => setCancelId(null)} title="Batalkan catatan penempatan">
        <div className="space-y-3">
          <p>Catatan bertanggal depan ini dibatalkan dan tidak akan berlaku. Catatannya tetap tersimpan.</p>
          <Field id="pl-cancel" label="Alasan pembatalan">
            <Textarea id="pl-cancel" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} />
          </Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCancelId(null)}>Kembali</Button>
            <Button variant="danger" onClick={cancel} loading={busy}>Batalkan catatan</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}

// ---------- Status ----------

type StatusDraft = {
  mode: 'DEACTIVATE' | 'REACTIVATE'; step: number; date: string;
  reasonKind: keyof typeof REASON_LABELS | ''; notice: keyof typeof NOTICE_LABELS | ''; note: string;
};

function StatusCard({ detail, path, canChange }: { detail: EmployeeDetail; path: string; canChange: boolean }) {
  const { summary, today } = detail;
  const [draft, setDraft] = useState<StatusDraft | null>(null);
  const { busy, error, setError, send } = useMutation(path);
  const lastKind = detail.events.at(-1)?.kind ?? 'REACTIVATE';
  const nextMode = lastKind === 'DEACTIVATE' ? 'REACTIVATE' : 'DEACTIVATE';
  const total = draft?.mode === 'DEACTIVATE' ? 3 : 2;
  const resigned = draft?.reasonKind === 'RESIGNED';

  function advance() {
    if (!draft) return;
    setError(null);
    if (draft.step === 1) {
      if (!draft.date || draft.note.trim().length < 3) return setError('Tanggal dan keterangan wajib diisi.');
      if (draft.mode === 'DEACTIVATE' && !draft.reasonKind) return setError('Pilih alasan.');
      return setDraft({ ...draft, step: draft.mode === 'DEACTIVATE' && resigned ? 2 : total });
    }
    if (draft.step === 2 && draft.mode === 'DEACTIVATE') {
      if (!draft.notice) return setError('Pilih cara berhenti.');
      return setDraft({ ...draft, step: 3 });
    }
  }

  async function save() {
    if (!draft) return;
    const body = draft.mode === 'DEACTIVATE'
      ? { kind: 'deactivate', lastWorkingDay: draft.date, reasonKind: draft.reasonKind, resignationNotice: resigned ? draft.notice : null, note: draft.note }
      : { kind: 'reactivate', startDate: draft.date, note: draft.note };
    const message = draft.mode === 'DEACTIVATE'
      ? `${summary.name} dicatat nonaktif sesudah ${formatLongDate(draft.date)}.`
      : `${summary.name} aktif lagi mulai ${formatLongDate(draft.date)}.`;
    if (await send(body, message)) setDraft(null);
  }

  const immediate = draft && (draft.mode === 'DEACTIVATE' ? addDays(draft.date, 1) <= today : draft.date <= today);

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="font-semibold">Status</h2>
        {canChange && !detail.isSelf && (
          <Button
            size="sm"
            variant={nextMode === 'DEACTIVATE' ? 'danger' : 'secondary'}
            onClick={() => { setError(null); setDraft({ mode: nextMode, step: 1, date: today, reasonKind: '', notice: '', note: '' }); }}
          >
            {nextMode === 'DEACTIVATE' ? 'Nonaktifkan' : 'Aktifkan lagi'}
          </Button>
        )}
      </div>
      {detail.events.length === 0 ? (
        <p className="text-sm text-ink-muted">Aktif sejak <LongDate value={detail.person?.joinedOn ?? null} />. Belum ada riwayat nonaktif.</p>
      ) : (
        <ol className="divide-y divide-line text-sm">
          {[...detail.events].reverse().map((e) => (
            <li key={e.id} className="py-2">
              <p className="font-medium">
                {e.kind === 'DEACTIVATE'
                  ? <>Nonaktif sesudah <LongDate value={addDays(e.effectiveOn, -1)} /> · {e.reasonKind ? REASON_LABELS[e.reasonKind] : ''}</>
                  : <>Aktif lagi mulai <LongDate value={e.effectiveOn} /></>}
              </p>
              {e.resignationNotice && <p>{NOTICE_LABELS[e.resignationNotice]}</p>}
              <p className="text-ink-muted">{e.note}</p>
            </li>
          ))}
        </ol>
      )}

      <Dialog open={!!draft} onClose={() => setDraft(null)} title={draft?.mode === 'DEACTIVATE' ? 'Nonaktifkan' : 'Aktifkan lagi'}>
        {draft && (
          <div className="space-y-3">
            {draft.step === 1 && (
              <>
                <StepLabel step={1} total={total} title={draft.mode === 'DEACTIVATE' ? 'Tanggal dan alasan' : 'Tanggal dan alasan'} />
                <Field id="st-date" label={draft.mode === 'DEACTIVATE' ? 'Tanggal terakhir bekerja' : 'Tanggal mulai aktif lagi'}>
                  <Input id="st-date" type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                </Field>
                {draft.mode === 'DEACTIVATE' && (
                  <Field id="st-reason" label="Alasan">
                    <Select id="st-reason" value={draft.reasonKind} onChange={(e) => setDraft({ ...draft, reasonKind: e.target.value as StatusDraft['reasonKind'] })}>
                      <option value="">Pilih</option>
                      {Object.entries(REASON_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </Select>
                  </Field>
                )}
                <Field id="st-note" label={draft.mode === 'DEACTIVATE' ? 'Keterangan' : 'Alasan'}>
                  <Textarea id="st-note" value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
                </Field>
                {draft.mode === 'REACTIVATE' && <p className="text-ink-muted">Penempatan memakai yang terakhir; bila perlu diubah, catat lewat Penempatan.</p>}
              </>
            )}
            {draft.step === 2 && draft.mode === 'DEACTIVATE' && (
              <>
                <StepLabel step={2} total={3} title="Cara berhenti" />
                {(Object.keys(NOTICE_LABELS) as (keyof typeof NOTICE_LABELS)[]).map((key) => {
                  const locked = key === 'WITHOUT_NOTICE' && !detail.rights.setUnnotified;
                  return (
                    <label key={key} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3">
                      <input type="radio" name="notice" disabled={locked} checked={draft.notice === key} onChange={() => setDraft({ ...draft, notice: key })} />
                      {NOTICE_LABELS[key]}{locked && <span className="text-ink-muted"> — hanya Pemilik dan GM</span>}
                    </label>
                  );
                })}
                {!detail.rights.setUnnotified && (
                  <p className="text-ink-muted">Bila orangnya berhenti tanpa pemberitahuan, minta Pemilik atau GM yang mencatatnya.</p>
                )}
              </>
            )}
            {draft.step === total && (draft.mode === 'REACTIVATE' || draft.step === 3) && (
              <>
                <StepLabel step={total} total={total} title="Periksa" />
                {draft.mode === 'DEACTIVATE' ? (
                  <>
                    <p>
                      {summary.name} terakhir bekerja {formatLongDate(draft.date)} ({draft.reasonKind ? REASON_LABELS[draft.reasonKind] : ''}
                      {resigned && draft.notice ? `, ${NOTICE_LABELS[draft.notice].toLowerCase()}` : ''}).
                    </p>
                    <p className="text-ink-muted">
                      {immediate
                        ? `Akun ${summary.name} keluar dari semua perangkat saat ini juga.`
                        : `Akses ${summary.name} berhenti mulai ${formatLongDate(addDays(draft.date, 1))}; akunnya dinonaktifkan pada hari itu.`}
                    </p>
                    {draft.notice === 'WITHOUT_NOTICE' && <Alert tone="warn">Sisa gaji menjadi denda (GAJ-58), dihitung di modul Gaji.</Alert>}
                  </>
                ) : (
                  <p>{summary.name} aktif lagi mulai {formatLongDate(draft.date)}. Riwayat lama tetap tersimpan; akun lama dipakai lagi.</p>
                )}
              </>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
            <div className="flex justify-between gap-2">
              <Button variant="secondary" onClick={() => (draft.step === 1 ? setDraft(null) : setDraft({ ...draft, step: 1 }))} disabled={busy}>Kembali</Button>
              {draft.step < total
                ? <Button onClick={advance}>Lanjut</Button>
                : <HoldButton variant={draft.mode === 'DEACTIVATE' ? 'danger' : 'primary'} onClick={save} loading={busy}>Simpan</HoldButton>}
            </div>
          </div>
        )}
      </Dialog>
    </Card>
  );
}

// ---------- Izin tugas lapangan ----------

/** Tanda jabatan "Tugas lapangan otomatis" (KAR-L31) menutup izin ini tanpa izin per orang. */
function autoCovers(duty: string, kind: 'DRIVE' | 'ASSIST'): boolean {
  return duty === 'BOTH' || duty === kind;
}

function PermitCard({ detail, path }: { detail: EmployeeDetail; path: string }) {
  const [revoking, setRevoking] = useState<'DRIVE' | 'ASSIST' | null>(null);
  const [reason, setReason] = useState('');
  const { busy, error, setError, send } = useMutation(path);
  const canChange = detail.rights.permits && !detail.isSelf && detail.summary.activeToday;
  const active = (kind: 'DRIVE' | 'ASSIST') => detail.permits.find((p) => p.kind === kind && !p.revokedAt);

  async function grant(kind: 'DRIVE' | 'ASSIST') {
    setError(null);
    await send({ kind: 'permit', permit: kind, granted: true }, `${PERMIT_LABELS[kind]} diberikan.`);
  }
  async function revoke() {
    if (!revoking) return;
    if (await send({ kind: 'permit', permit: revoking, granted: false, reason }, `${PERMIT_LABELS[revoking]} dicabut.`)) setRevoking(null);
  }

  return (
    <Card>
      <h2 className="mb-2 font-semibold">Izin tugas lapangan</h2>
      <ul className="divide-y divide-line text-sm">
        {(['DRIVE', 'ASSIST'] as const).map((kind) => {
          const permit = active(kind);
          return (
            <li key={kind} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <span>
                <span className="font-medium">{PERMIT_LABELS[kind]}</span>{' '}
                {permit ? <span className="text-ink-muted">· sejak <LongDate value={permit.grantedAt} /></span> : <span className="text-ink-muted">· belum diberi</span>}
                {autoCovers(detail.autoFieldDuty, kind) && <> <Badge tone="ok">Otomatis (jabatan {detail.summary.positionName})</Badge></>}
              </span>
              {canChange && (permit
                ? <Button size="sm" variant="ghost" onClick={() => { setError(null); setReason(''); setRevoking(kind); }}>Cabut</Button>
                : <Button size="sm" variant="secondary" onClick={() => grant(kind)} loading={busy}>Beri izin</Button>)}
            </li>
          );
        })}
      </ul>
      {error && !revoking && <div className="mt-2"><Alert tone="danger">{error}</Alert></div>}
      <Dialog open={!!revoking} onClose={() => setRevoking(null)} title="Cabut izin">
        <div className="space-y-3">
          <Field id="pm-reason" label="Alasan mencabut"><Textarea id="pm-reason" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          {error && <Alert tone="danger">{error}</Alert>}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRevoking(null)}>Kembali</Button>
            <Button variant="danger" onClick={revoke} loading={busy}>Cabut izin</Button>
          </div>
        </div>
      </Dialog>
    </Card>
  );
}
