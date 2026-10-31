'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select, Textarea } from '@/components/ui/field';
import { Alert, Badge } from '@/components/ui/surface';
import { useToast } from '@/components/ui/toast';
import { cn } from '@/lib/cn';
import { postJson } from './api';

type Department = { id: number; name: string; active: boolean };
type Branch = {
  id: number; name: string; address: string | null; latitude: number | null; longitude: number | null;
  kasirBranchId: number | null; mergedIntoBranchId: number | null; active: boolean; holders: number;
};
type Position = {
  id: number; name: string; departmentId: number; highRights: boolean; fullAccess: boolean; active: boolean; holders: number;
};
type KasirBranch = { id: number; code: string; name: string; active: boolean };

export type OrganizationData = {
  departments: Department[];
  branches: Branch[];
  positions: Position[];
  kasirBranches: KasirBranch[];
};

type Tab = 'branch' | 'department' | 'position';
const TABS: { key: Tab; label: string }[] = [
  { key: 'branch', label: 'Cabang' },
  { key: 'department', label: 'Departemen' },
  { key: 'position', label: 'Jabatan' },
];

function ActiveBadge({ active }: { active: boolean }) {
  return active ? <Badge tone="ok">Aktif</Badge> : <Badge tone="warn">Nonaktif</Badge>;
}

/** Hook kecil untuk simpan → toast → muat ulang data server. */
function useSave(onDone: () => void) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function save(body: unknown) {
    setBusy(true);
    setError(null);
    const result = await postJson('/api/access/org', body);
    setBusy(false);
    if (!result.ok) return setError(result.error ?? 'Gagal menyimpan.');
    toast('Perubahan tersimpan.', 'ok');
    onDone();
    router.refresh();
  }
  return { busy, error, setError, save };
}

export function OrganizationScreen({ data, canEditHighRights }: { data: OrganizationData; canEditHighRights: boolean }) {
  const [tab, setTab] = useState<Tab>('branch');
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Daftar organisasi" className="flex gap-1 rounded-lg border border-line bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'min-h-10 flex-1 rounded-md text-sm font-medium',
              tab === t.key ? 'bg-brand-100 text-brand-700' : 'text-ink-muted hover:bg-canvas',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'branch' && <BranchList data={data} />}
      {tab === 'department' && <DepartmentList data={data} />}
      {tab === 'position' && <PositionList data={data} canEditHighRights={canEditHighRights} />}
    </div>
  );
}

// ---------- Cabang ----------

type BranchForm = {
  id?: number; name: string; address: string; latitude: string; longitude: string;
  kasirBranchId: string; mergedIntoBranchId: string; active: boolean;
};
const emptyBranch: BranchForm = {
  name: '', address: '', latitude: '', longitude: '', kasirBranchId: '', mergedIntoBranchId: '', active: true,
};

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim().replace(',', '.');
  return trimmed === '' ? null : Number(trimmed);
}

function BranchList({ data }: { data: OrganizationData }) {
  const [form, setForm] = useState<BranchForm | null>(null);
  const { busy, error, setError, save } = useSave(() => setForm(null));
  const kasirName = (id: number | null) => data.kasirBranches.find((k) => k.id === id)?.name ?? '—';
  const branchName = (id: number | null) => data.branches.find((b) => b.id === id)?.name ?? '—';

  function open(branch?: Branch) {
    setError(null);
    setForm(branch ? {
      id: branch.id, name: branch.name, address: branch.address ?? '',
      latitude: branch.latitude?.toString() ?? '', longitude: branch.longitude?.toString() ?? '',
      kasirBranchId: branch.kasirBranchId?.toString() ?? '', mergedIntoBranchId: branch.mergedIntoBranchId?.toString() ?? '',
      active: branch.active,
    } : emptyBranch);
  }

  function submit(event: React.SyntheticEvent) {
    event.preventDefault();
    if (!form) return;
    const latitude = toNumberOrNull(form.latitude);
    const longitude = toNumberOrNull(form.longitude);
    if (Number.isNaN(latitude) || Number.isNaN(longitude)) return setError('Lintang dan bujur harus berupa angka.');
    void save({
      kind: 'branch', id: form.id, name: form.name, address: form.address || null, latitude, longitude,
      kasirBranchId: form.kasirBranchId ? Number(form.kasirBranchId) : null,
      mergedIntoBranchId: form.mergedIntoBranchId ? Number(form.mergedIntoBranchId) : null,
      active: form.active,
    });
  }

  return (
    <>
      <div className="flex justify-end"><Button onClick={() => open()}>Tambah cabang</Button></div>
      <DataList
        rows={data.branches}
        rowKey={(b) => b.id}
        empty="Belum ada cabang. Cabang dari sistem lama dimuat pada langkah muat data awal."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (b) => b.name },
          { key: 'kasir', header: 'Cabang kasir', render: (b) => kasirName(b.kasirBranchId) },
          { key: 'merged', header: 'Digabung ke', render: (b) => branchName(b.mergedIntoBranchId) },
          { key: 'location', header: 'Titik lokasi', render: (b) => (b.latitude != null ? `${b.latitude}, ${b.longitude}` : '—') },
          { key: 'active', header: 'Status', render: (b) => <ActiveBadge active={b.active} /> },
          { key: 'edit', header: '', render: (b) => <Button size="sm" variant="secondary" onClick={() => open(b)}>Ubah</Button> },
        ]}
      />
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Ubah cabang' : 'Tambah cabang'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Batal</Button>
            <Button type="submit" form="branch-form" loading={busy}>Simpan</Button>
          </>
        )}
      >
        {form && (
          <form id="branch-form" onSubmit={submit} className="space-y-3">
            <Field id="branch-name" label="Nama cabang">
              <Input id="branch-name" value={form.name} required maxLength={100}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field id="branch-address" label="Alamat">
              <Textarea id="branch-address" value={form.address} maxLength={500}
                onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field id="branch-lat" label="Lintang" hint="Contoh -6.2">
                <Input id="branch-lat" inputMode="decimal" value={form.latitude}
                  onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
              </Field>
              <Field id="branch-lng" label="Bujur" hint="Contoh 106.8">
                <Input id="branch-lng" inputMode="decimal" value={form.longitude}
                  onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
              </Field>
            </div>
            <Field id="branch-kasir" label="Cabang kasir" hint="Cabang di aplikasi kasir yang sama dengan cabang ini.">
              <Select id="branch-kasir" value={form.kasirBranchId}
                onChange={(e) => setForm({ ...form, kasirBranchId: e.target.value })}>
                <option value="">Tidak ditautkan</option>
                {data.kasirBranches.map((k) => (
                  <option key={k.id} value={k.id}>{k.name}{k.active ? '' : ' (nonaktif)'}</option>
                ))}
              </Select>
            </Field>
            <Field id="branch-merged" label="Digabung ke" hint="Hanya untuk laporan keuangan (mis. Back Office → Gudang).">
              <Select id="branch-merged" value={form.mergedIntoBranchId}
                onChange={(e) => setForm({ ...form, mergedIntoBranchId: e.target.value })}>
                <option value="">Tidak digabung</option>
                {data.branches.filter((b) => b.id !== form.id && b.active && b.mergedIntoBranchId == null).map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </Select>
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Aktif
            </label>
            {error && <Alert tone="danger">{error}</Alert>}
          </form>
        )}
      </Dialog>
    </>
  );
}

// ---------- Departemen ----------

function DepartmentList({ data }: { data: OrganizationData }) {
  const [form, setForm] = useState<{ id?: number; name: string; active: boolean } | null>(null);
  const { busy, error, setError, save } = useSave(() => setForm(null));
  const positionCount = (id: number) => data.positions.filter((p) => p.departmentId === id && p.active).length;

  function open(department?: Department) {
    setError(null);
    setForm(department ? { id: department.id, name: department.name, active: department.active } : { name: '', active: true });
  }

  return (
    <>
      <div className="flex justify-end"><Button onClick={() => open()}>Tambah departemen</Button></div>
      <DataList
        rows={data.departments}
        rowKey={(d) => d.id}
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (d) => d.name },
          { key: 'positions', header: 'Jabatan aktif', render: (d) => positionCount(d.id) },
          { key: 'active', header: 'Status', render: (d) => <ActiveBadge active={d.active} /> },
          { key: 'edit', header: '', render: (d) => <Button size="sm" variant="secondary" onClick={() => open(d)}>Ubah</Button> },
        ]}
      />
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Ubah departemen' : 'Tambah departemen'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Batal</Button>
            <Button type="submit" form="department-form" loading={busy}>Simpan</Button>
          </>
        )}
      >
        {form && (
          <form
            id="department-form"
            onSubmit={(e) => { e.preventDefault(); void save({ kind: 'department', ...form }); }}
            className="space-y-3"
          >
            <Field id="department-name" label="Nama departemen">
              <Input id="department-name" value={form.name} required maxLength={100}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Aktif
            </label>
            {error && <Alert tone="danger">{error}</Alert>}
          </form>
        )}
      </Dialog>
    </>
  );
}

// ---------- Jabatan ----------

type PositionForm = { id?: number; name: string; departmentId: string; highRights: boolean; active: boolean; fullAccess: boolean };

function PositionList({ data, canEditHighRights }: { data: OrganizationData; canEditHighRights: boolean }) {
  const [form, setForm] = useState<PositionForm | null>(null);
  const { busy, error, setError, save } = useSave(() => setForm(null));
  const departmentName = (id: number) => data.departments.find((d) => d.id === id)?.name ?? '—';
  const activeDepartments = data.departments.filter((d) => d.active);

  function open(position?: Position) {
    setError(null);
    setForm(position ? {
      id: position.id, name: position.name, departmentId: String(position.departmentId),
      highRights: position.highRights, active: position.active, fullAccess: position.fullAccess,
    } : { name: '', departmentId: activeDepartments[0] ? String(activeDepartments[0].id) : '', highRights: false, active: true, fullAccess: false });
  }

  return (
    <>
      <div className="flex justify-end"><Button onClick={() => open()}>Tambah jabatan</Button></div>
      <DataList
        rows={data.positions}
        rowKey={(p) => p.id}
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (p) => p.name },
          { key: 'department', header: 'Departemen', render: (p) => departmentName(p.departmentId) },
          {
            key: 'rights', header: 'Tanda',
            render: (p) => (p.fullAccess ? <Badge tone="info">Berhak penuh</Badge> : p.highRights ? <Badge tone="warn">Berhak tinggi</Badge> : '—'),
          },
          { key: 'holders', header: 'Pemegang', render: (p) => p.holders },
          { key: 'active', header: 'Status', render: (p) => <ActiveBadge active={p.active} /> },
          { key: 'edit', header: '', render: (p) => <Button size="sm" variant="secondary" onClick={() => open(p)}>Ubah</Button> },
        ]}
      />
      <Dialog
        open={form !== null}
        onClose={() => setForm(null)}
        title={form?.id ? 'Ubah jabatan' : 'Tambah jabatan'}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setForm(null)}>Batal</Button>
            <Button type="submit" form="position-form" loading={busy}>Simpan</Button>
          </>
        )}
      >
        {form && (
          <form
            id="position-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save({
                kind: 'position', id: form.id, name: form.name, departmentId: Number(form.departmentId),
                highRights: form.highRights, active: form.active,
              });
            }}
            className="space-y-3"
          >
            {!form.id && <Alert tone="info">Jabatan baru lahir tanpa hak apa pun. Hak diatur Pemilik atau GM di Hak Akses Jabatan.</Alert>}
            {form.fullAccess && <Alert tone="info">Jabatan berhak penuh: tanda dan status aktifnya tidak bisa diubah dari layar.</Alert>}
            <Field id="position-name" label="Nama jabatan">
              <Input id="position-name" value={form.name} required maxLength={100}
                onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field id="position-department" label="Departemen">
              <Select id="position-department" value={form.departmentId} required
                onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
                {data.departments.filter((d) => d.active || String(d.id) === form.departmentId).map((d) => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </Select>
            </Field>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.highRights} disabled={!canEditHighRights || form.fullAccess}
                onChange={(e) => setForm({ ...form, highRights: e.target.checked })} />
              Berhak tinggi {!canEditHighRights && <span className="text-ink-muted">(hanya Pemilik dan GM yang bisa mengubah)</span>}
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input type="checkbox" checked={form.active} disabled={form.fullAccess}
                onChange={(e) => setForm({ ...form, active: e.target.checked })} />
              Aktif
            </label>
            {error && <Alert tone="danger">{error}</Alert>}
          </form>
        )}
      </Dialog>
    </>
  );
}
