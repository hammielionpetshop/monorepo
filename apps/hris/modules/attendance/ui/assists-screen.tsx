'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge } from '@/components/ui/surface';

type Row = { id: number; name: string; home: string; target: string; date: string; shift: string; chosen: boolean };

/** KEH-L11. Hari ini + 7 hari; yang lebih lama dimuat saat diminta. */
export function AssistsScreen({ days, branchId, branches, rows }: {
  days: number; branchId: number | null; branches: { id: number; name: string }[]; rows: Row[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const shown = rows.filter((row) => row.name.toLowerCase().includes(search.trim().toLowerCase()));
  const link = (branch: number | null, range: number) => {
    const params = new URLSearchParams();
    if (branch) params.set('branch', String(branch));
    if (range !== 7) params.set('days', String(range));
    const query = params.toString();
    return query ? `/kehadiran/perbantuan?${query}` : '/kehadiran/perbantuan';
  };
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <Field id="assist-search" label="Cari nama"><Input id="assist-search" value={search} onChange={(event) => setSearch(event.target.value)} /></Field>
        <Field id="assist-branch" label="Cabang tujuan">
          <Select id="assist-branch" value={branchId ?? ''} onChange={(event) => router.push(link(event.target.value ? Number(event.target.value) : null, days))}>
            <option value="">Semua yang boleh dilihat</option>
            {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
          </Select>
        </Field>
      </div>
      <DataList
        rows={shown}
        rowKey={(row) => row.id}
        empty="Belum ada perbantuan pada rentang ini."
        columns={[
          { key: 'name', header: 'Nama', primary: true, render: (row) => row.name },
          { key: 'date', header: 'Tanggal', render: (row) => row.date },
          { key: 'home', header: 'Cabang asal', render: (row) => row.home },
          { key: 'target', header: 'Cabang tujuan', render: (row) => row.target },
          { key: 'shift', header: 'Shift', render: (row) => row.shift },
          { key: 'chosen', header: '', render: (row) => (row.chosen ? <Badge tone="warn">Shift dipilih sendiri</Badge> : null) },
        ]}
      />
      {days < 90 && <Link className={buttonClass({ variant: 'secondary', size: 'sm' })} href={link(branchId, 90)}>Muat 90 hari</Link>}
    </div>
  );
}
