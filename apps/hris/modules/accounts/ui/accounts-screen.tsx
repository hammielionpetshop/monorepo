'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Dialog } from '@/components/ui/dialog';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { KASIR_ROLE_LABELS, type KasirRole } from '../rules/accounts';
import type { AccountsScreenData } from '../server/accounts';
import { AccountStateBadge, DateTime, HoldButton, useMutation } from './shared';

type Row = AccountsScreenData['rows'][number];
type View = 'all' | 'unlinked' | 'kasir' | 'inactive';

const VIEWS: Record<View, string> = {
  all: 'Semua', unlinked: 'Belum tertaut', kasir: 'Punya akses kasir', inactive: 'Nonaktif',
};

/** Akun & Tautan (spec L2d §6): semua akun pusat beserta tautan karyawan dan akses kasirnya. */
export function AccountsScreen({ data }: { data: AccountsScreenData }) {
  const [view, setView] = useState<View>('all');
  const [query, setQuery] = useState('');
  const [linking, setLinking] = useState<Row | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.rows.filter((row) => {
      if (view === 'unlinked' && row.employee) return false;
      if (view === 'kasir' && !row.kasir?.isActive) return false;
      if (view === 'inactive' && row.isActive) return false;
      if (!q) return true;
      return [row.email, row.username, row.employee?.name, row.employee?.code].some((v) => v?.toLowerCase().includes(q));
    });
  }, [data.rows, view, query]);

  return (
    <div className="space-y-4">
      {data.kasirError && <Alert tone="warn" title="Akses kasir tidak bisa dibaca">{data.kasirError}</Alert>}
      <Card>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field id="q" label="Cari">
            <Input id="q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Email, nama, atau kode karyawan" />
          </Field>
          <Field id="view" label="Tampilkan">
            <Select id="view" value={view} onChange={(e) => setView(e.target.value as View)}>
              {Object.entries(VIEWS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </Select>
          </Field>
        </div>
      </Card>
      <DataList
        rows={rows}
        rowKey={(row) => row.accountId}
        empty="Tidak ada akun yang cocok."
        columns={[
          {
            key: 'account', header: 'Akun', primary: true,
            render: (row) => <span className="break-all">{row.email ?? row.username}</span>,
          },
          {
            key: 'employee', header: 'Karyawan',
            render: (row) => row.employee ? (
              <Link href={`/karyawan/${row.employee.id}`} className="text-brand-700 hover:underline">
                {row.employee.name} <span className="text-ink-muted">({row.employee.code})</span>
              </Link>
            ) : row.isSelf ? <span className="text-ink-muted">Akun Anda</span> : (
              <Button size="sm" variant="secondary" disabled={!data.unlinkedEmployees.length} onClick={() => setLinking(row)}>
                Tautkan ke karyawan
              </Button>
            ),
          },
          { key: 'state', header: 'Status', render: (row) => <AccountStateBadge account={row} /> },
          {
            key: 'kasir', header: 'Akses kasir',
            render: (row) => row.kasir ? (
              row.kasir.isActive
                ? <span>{KASIR_ROLE_LABELS[row.kasir.roleName as KasirRole] ?? row.kasir.roleName} · {row.kasir.branchName}</span>
                : <Badge tone="danger">Dicabut</Badge>
            ) : <span className="text-ink-muted">—</span>,
          },
          { key: 'last', header: 'Terakhir masuk', render: (row) => <DateTime value={row.lastLoginAt} /> },
        ]}
      />
      <p className="text-sm text-ink-muted">
        Akun dibuat, direset, dan diberi akses kasir dari halaman orangnya. Akun &quot;belum tertaut&quot; biasanya pengguna
        kasir lama: tautkan ke data karyawannya supaya bisa masuk HRIS.
      </p>
      {linking && <LinkToEmployeeDialog row={linking} employees={data.unlinkedEmployees} onClose={() => setLinking(null)} />}
    </div>
  );
}

function LinkToEmployeeDialog({ row, employees, onClose }: {
  row: Row; employees: AccountsScreenData['unlinkedEmployees']; onClose: () => void;
}) {
  const [employeeId, setEmployeeId] = useState('');
  const { busy, error, send } = useMutation(`/api/accounts/employee/${employeeId || 0}`);
  const chosen = employees.find((e) => String(e.id) === employeeId);
  const save = async () => {
    if (await send({ kind: 'link', accountId: row.accountId }, 'Akun ditautkan.')) onClose();
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Tautkan ke karyawan"
      footer={<><Button variant="secondary" onClick={onClose}>Batal</Button>{chosen && <HoldButton key={employeeId} loading={busy} onClick={save}>Tautkan</HoldButton>}</>}
    >
      <div className="space-y-3">
        <p>Akun <strong className="break-all">{row.email ?? row.username}</strong> milik siapa?</p>
        <Field id="employeeId" label="Karyawan (aktif, belum punya akun)">
          <Select id="employeeId" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">Pilih karyawan</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}
          </Select>
        </Field>
        {chosen && <p>Sesudah ditautkan, akun ini bisa masuk HRIS sebagai {chosen.name}.</p>}
        {error && <Alert tone="danger">{error}</Alert>}
      </div>
    </Dialog>
  );
}
