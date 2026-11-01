'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { NewBadge } from '@/components/ui/new-badge';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import {
  KASIR_ROLES, KASIR_ROLE_LABELS, generatePassword, isValidEmail, passwordProblem, type KasirRole,
} from '../rules/accounts';
import type { EmployeeAccountPanel } from '../server/accounts';
import { AccountStateBadge, DateTime, HoldButton, Row, useMutation } from './shared';

type Dialogs = 'create' | 'link' | 'reset' | 'sessions' | 'unlink' | 'kasir' | 'kasir_revoke' | null;

/** Kartu Akun di Halaman orang (spec L2d §6). Tombol tanpa hak tidak tampil; server tetap memeriksa. */
export function EmployeeAccountCard({ panel }: { panel: EmployeeAccountPanel }) {
  const [open, setOpen] = useState<Dialogs>(null);
  const { employee, account, rights } = panel;
  const path = `/api/accounts/employee/${employee.id}`;
  const close = () => setOpen(null);
  const locked = !employee.activeToday;

  return (
    <Card>
      <h2 className="mb-2 font-semibold">Akun</h2>
      {account ? (
        <>
          <dl className="divide-y divide-line">
            <Row label="Email masuk">{account.email ?? account.username}</Row>
            <Row label="Status akun"><AccountStateBadge account={account} /></Row>
            <Row label="Terakhir masuk"><DateTime value={account.lastLoginAt} /></Row>
          </dl>
          {!locked && (rights.resetPassword || rights.revokeSessions || rights.manage) && (
            <div className="mt-3 flex flex-wrap gap-2">
              {rights.resetPassword && <Button size="sm" variant="secondary" onClick={() => setOpen('reset')}>Reset password</Button>}
              {rights.revokeSessions && <Button size="sm" variant="secondary" onClick={() => setOpen('sessions')}>Keluarkan dari semua perangkat</Button>}
              {rights.manage && <Button size="sm" variant="ghost" onClick={() => setOpen('unlink')}>Lepas tautan</Button>}
            </div>
          )}
          {rights.kasir && <KasirSection panel={panel} onEdit={() => setOpen('kasir')} onRevoke={() => setOpen('kasir_revoke')} />}
        </>
      ) : (
        <>
          <p className="text-sm text-ink-muted">
            {locked ? 'Karyawan nonaktif dan belum punya akun.' : 'Orang ini belum punya akun untuk masuk HRIS atau kasir.'}
          </p>
          {!locked && rights.manage && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setOpen('create')}>Buat akun</Button>
              {panel.linkCandidates.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setOpen('link')}>Tautkan akun yang ada</Button>
              )}
            </div>
          )}
        </>
      )}
      {locked && account && <p className="mt-3 text-sm text-ink-muted">Karyawan nonaktif: akunnya ikut nonaktif dan tidak bisa diubah.</p>}

      {open === 'create' && <CreateDialog panel={panel} path={path} onClose={close} />}
      {open === 'link' && <LinkDialog panel={panel} path={path} onClose={close} />}
      {open === 'reset' && <ResetDialog panel={panel} path={path} onClose={close} />}
      {open === 'sessions' && <SessionsDialog panel={panel} path={path} onClose={close} />}
      {open === 'unlink' && <UnlinkDialog panel={panel} path={path} onClose={close} />}
      {open === 'kasir' && <KasirDialog panel={panel} path={path} onClose={close} />}
      {open === 'kasir_revoke' && <KasirRevokeDialog panel={panel} path={path} onClose={close} />}
    </Card>
  );
}

type DialogProps = { panel: EmployeeAccountPanel; path: string; onClose: () => void };

function PasswordField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Field id="password" label="Password awal" hint="Minimal 8 karakter. Orangnya wajib menggantinya saat masuk pertama.">
      <div className="flex gap-2">
        <Input id="password" value={value} onChange={(e) => onChange(e.target.value)} autoComplete="off" className="font-mono" />
        <Button variant="secondary" onClick={() => onChange(generatePassword())}>Buat acak</Button>
      </div>
    </Field>
  );
}

function PasswordNotice({ password }: { password: string }) {
  return (
    <Alert tone="warn" title="Catat password ini sekarang">
      <p className="font-mono text-base">{password}</p>
      <p>Berikan langsung ke orangnya. Password ini tidak ditampilkan lagi; ia wajib menggantinya saat masuk pertama.</p>
    </Alert>
  );
}

function CreateDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, setError, send } = useMutation(path);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState(panel.employee.email ?? '');
  const [password, setPassword] = useState(() => generatePassword());
  const next = () => {
    if (!isValidEmail(email)) return setError('Email tidak valid. Pakai email asli orangnya.');
    const problem = passwordProblem(password);
    if (problem) return setError(problem);
    setError(null);
    setStep(2);
  };
  const save = async () => {
    if (await send({ kind: 'create', email, password }, 'Akun dibuat.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Buat akun — ${panel.employee.name}`}
      footer={step === 1 ? (
        <><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={next}>Lanjut</Button></>
      ) : (
        <><Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button><HoldButton loading={busy} onClick={save}>Buat akun</HoldButton></>
      )}
    >
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Langkah {step} dari 2 — {step === 1 ? 'Isi' : 'Periksa'}</p>
        {step === 1 ? (
          <>
            <Field id="email" label="Email masuk" hint="Email asli orangnya (KAR-69); dipakai untuk masuk HRIS.">
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
            </Field>
            <PasswordField value={password} onChange={setPassword} />
          </>
        ) : (
          <>
            <dl className="divide-y divide-line">
              <Row label="Karyawan">{panel.employee.name} ({panel.employee.code})</Row>
              <Row label="Email masuk">{email.trim().toLowerCase()}</Row>
            </dl>
            <PasswordNotice password={password} />
            <p>Akses kasir diberikan terpisah sesudah akun dibuat.</p>
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

function LinkDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, send } = useMutation(path);
  const [accountId, setAccountId] = useState('');
  const chosen = panel.linkCandidates.find((c) => String(c.accountId) === accountId);
  const save = async () => {
    if (await send({ kind: 'link', accountId: Number(accountId) }, 'Akun ditautkan.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Tautkan akun — ${panel.employee.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button>{chosen && <HoldButton key={accountId} loading={busy} onClick={save}>Tautkan</HoldButton>}</>}
    >
      <div className="space-y-3">
        <p>Untuk pengguna kasir lama yang sudah punya akun. Pilih akun milik orang ini.</p>
        <Field id="accountId" label="Akun">
          <Select id="accountId" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
            <option value="">Pilih akun</option>
            {panel.linkCandidates.map((c) => <option key={c.accountId} value={c.accountId}>{c.label}</option>)}
          </Select>
        </Field>
        {chosen && <p>Sesudah ditautkan, <strong>{chosen.label}</strong> bisa masuk HRIS sebagai {panel.employee.name}.</p>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

function ResetDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, send } = useMutation(path);
  const [password, setPassword] = useState(() => generatePassword());
  const problem = passwordProblem(password);
  const save = async () => {
    if (await send({ kind: 'reset_password', password }, 'Password direset.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`Reset password — ${panel.employee.name}`}
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><HoldButton loading={busy} disabled={!!problem} onClick={save}>Reset password</HoldButton></>}
    >
      <div className="space-y-3">
        <PasswordField value={password} onChange={setPassword} />
        {problem ? <Alert tone="danger">{problem}</Alert> : <PasswordNotice password={password} />}
        <p>Orang ini keluar dari semua perangkat dan wajib mengganti password saat masuk lagi.</p>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

function SessionsDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, send } = useMutation(path);
  const save = async () => {
    if (await send({ kind: 'revoke_sessions' }, 'Semua perangkat dikeluarkan.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Keluarkan dari semua perangkat"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><HoldButton variant="danger" loading={busy} onClick={save}>Keluarkan</HoldButton></>}
    >
      <p>{panel.employee.name} keluar dari HRIS dan kasir di semua perangkat saat ini juga. Password tidak berubah; ia bisa masuk lagi.</p>
      {error && <Alert tone="danger">{error}</Alert>}
    </Dialog>
  );
}

function UnlinkDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, setError, send } = useMutation(path);
  const [reason, setReason] = useState('');
  const save = async () => {
    if (!reason.trim()) return setError('Alasan wajib diisi.');
    if (await send({ kind: 'unlink', reason }, 'Tautan dilepas.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Lepas tautan akun"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><HoldButton variant="danger" loading={busy} onClick={save}>Lepas tautan</HoldButton></>}
    >
      <div className="space-y-3">
        <p>
          Akun ini tidak lagi menjadi milik {panel.employee.name}: orang ini tidak bisa masuk HRIS sampai ditautkan lagi.
          Akses kasirnya tidak berubah; cabut terpisah bila perlu.
        </p>
        <Field id="reason" label="Alasan">
          <Textarea id="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} />
        </Field>
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

// ---------- Akses kasir ----------

function KasirSection({ panel, onEdit, onRevoke }: { panel: EmployeeAccountPanel; onEdit: () => void; onRevoke: () => void }) {
  const access = panel.kasir?.access ?? null;
  const locked = !panel.employee.activeToday;
  return (
    <div className="mt-4 border-t border-line pt-3">
      <h3 className="mb-1 text-sm font-semibold">Akses kasir</h3>
      {panel.kasirError ? (
        <Alert tone="warn">{panel.kasirError}</Alert>
      ) : access ? (
        <dl className="divide-y divide-line">
          <Row label="Status">{access.isActive ? <Badge tone="ok">Punya akses kasir</Badge> : <Badge tone="danger">Dicabut</Badge>}</Row>
          <Row label="Role">{KASIR_ROLE_LABELS[access.roleName as KasirRole] ?? access.roleName}</Row>
          <Row label="Cabang utama">{access.branchName}</Row>
          <Row label="Cabang tugas">{access.assignedBranches.map((b) => b.name).join(', ') || '—'}</Row>
          <Row label="Nomor staf">{access.staffNumber}</Row>
        </dl>
      ) : (
        <p className="text-sm text-ink-muted">Belum punya akses kasir.</p>
      )}
      {!panel.kasirError && !locked && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={onEdit}>
            {access?.isActive ? 'Ubah akses kasir' : 'Beri akses kasir'}
          </Button>
          {access?.isActive && <Button size="sm" variant="ghost" onClick={onRevoke}>Cabut akses kasir</Button>}
        </div>
      )}
    </div>
  );
}

function KasirDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, setError, send } = useMutation(path);
  const access = panel.kasir?.access ?? null;
  const options = panel.kasir?.options ?? { roles: [], branches: [] };
  const roles = KASIR_ROLES.filter((r) => options.roles.includes(r));
  const [step, setStep] = useState<1 | 2>(1);
  // Akses baru: role terisi dari saran jabatan (Pengaturan Jabatan), tetap bisa diganti.
  const suggested = !access && panel.suggestedRole && roles.includes(panel.suggestedRole as KasirRole) ? panel.suggestedRole : null;
  const [roleName, setRoleName] = useState<string>(access && roles.includes(access.roleName as KasirRole) ? access.roleName : suggested ?? '');
  const [branchId, setBranchId] = useState(access ? String(access.branchId) : '');
  const [extra, setExtra] = useState<number[]>(access ? access.assignedBranches.map((b) => b.id) : []);
  const branchName = (id: number) => options.branches.find((b) => b.id === id)?.name ?? `#${id}`;
  const assigned = Array.from(new Set([Number(branchId), ...extra])).filter((id) => id > 0);
  const toggle = (id: number) => setExtra((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));
  const next = () => {
    if (!roleName) return setError('Pilih role kasir.');
    if (!branchId) return setError('Pilih cabang utama.');
    setError(null);
    setStep(2);
  };
  const save = async () => {
    const ok = await send({ kind: 'kasir', active: true, roleName, branchId: Number(branchId), assignedBranchIds: assigned },
      access ? 'Akses kasir diubah.' : 'Akses kasir diberikan.');
    if (ok) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title={`${access?.isActive ? 'Ubah' : 'Beri'} akses kasir — ${panel.employee.name}`}
      footer={step === 1 ? (
        <><Button variant="secondary" onClick={onClose}>Batal</Button><Button onClick={next}>Lanjut</Button></>
      ) : (
        <><Button variant="secondary" onClick={() => setStep(1)}>Kembali</Button><HoldButton loading={busy} onClick={save}>Simpan</HoldButton></>
      )}
    >
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Langkah {step} dari 2 — {step === 1 ? 'Isi' : 'Periksa'}</p>
        {step === 1 ? (
          <>
            {suggested && <p className="flex items-center gap-2 text-sm"><NewBadge feature="fitur/saran-role-kasir" />Role terisi dari saran jabatan {panel.employee.positionName}.</p>}
            <Field id="roleName" label="Role kasir" hint={suggested && roleName === suggested ? `Saran dari jabatan ${panel.employee.positionName}; boleh diganti.` : 'Dipilih langsung; jabatan hanya memberi saran.'}>
              <Select id="roleName" value={roleName} onChange={(e) => setRoleName(e.target.value)}>
                <option value="">Pilih role</option>
                {roles.map((r) => <option key={r} value={r}>{KASIR_ROLE_LABELS[r]}</option>)}
              </Select>
            </Field>
            <Field id="branchId" label="Cabang utama" hint="Cabang aktif saat orang ini masuk kasir.">
              <Select id="branchId" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                <option value="">Pilih cabang</option>
                {options.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <fieldset className="space-y-1">
              <legend className="text-sm font-medium">Cabang tugas lain</legend>
              {options.branches.filter((b) => String(b.id) !== branchId).map((b) => (
                <label key={b.id} className="flex min-h-9 items-center gap-2 text-sm">
                  <input type="checkbox" checked={extra.includes(b.id)} onChange={() => toggle(b.id)} />
                  {b.name}
                </label>
              ))}
            </fieldset>
          </>
        ) : (
          <>
            <dl className="divide-y divide-line">
              <Row label="Role">{KASIR_ROLE_LABELS[roleName as KasirRole]}</Row>
              <Row label="Cabang utama">{branchName(Number(branchId))}</Row>
              <Row label="Cabang tugas">{assigned.map(branchName).join(', ')}</Row>
            </dl>
            {access?.isActive ? (
              <p>Bila orang ini sedang masuk kasir, ia diminta membuka kasir lagi supaya perubahan berlaku.</p>
            ) : (
              <p>
                Orang ini masuk kasir dengan akun yang sama. Nomor staf = kode karyawan ({panel.employee.code}); PIN bawaan
                wajib diganti saat pertama masuk kasir.
              </p>
            )}
          </>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}

function KasirRevokeDialog({ panel, path, onClose }: DialogProps) {
  const { busy, error, send } = useMutation(path);
  const save = async () => {
    if (await send({ kind: 'kasir', active: false }, 'Akses kasir dicabut.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Cabut akses kasir"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button><HoldButton variant="danger" loading={busy} onClick={save}>Cabut</HoldButton></>}
    >
      <p>
        {panel.employee.name} tidak bisa masuk kasir/backoffice lagi dan langsung keluar dari kasir. Akun HRIS-nya tetap
        jalan. Pengguna kasirnya dinonaktifkan, tidak dihapus.
      </p>
      {error && <Alert tone="danger">{error}</Alert>}
    </Dialog>
  );
}
