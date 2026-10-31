import Link from 'next/link';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge, Card } from '@/components/ui/surface';
import { WORK_STATUSES, WORK_STATUS_LABELS } from '../rules/history';
import type { EmployeeFilter, EmployeeListing } from '../server/employees';

type FullRow = Extract<EmployeeListing['rows'][number], { activeToday: boolean }>;
type DirectoryRow = Exclude<EmployeeListing['rows'][number], FullRow>;

function PersonLink({ id, name, canOpen }: { id: number; name: string; canOpen: boolean }) {
  return canOpen ? <Link href={`/karyawan/${id}`} className="font-medium text-brand-700 hover:underline">{name}</Link> : <>{name}</>;
}

function Permits({ permits }: { permits: { DRIVE: boolean; ASSIST: boolean } }) {
  if (!permits.DRIVE && !permits.ASSIST) return <span className="text-ink-muted">—</span>;
  return (
    <span className="flex flex-wrap justify-end gap-1 md:justify-start">
      {permits.DRIVE && <Badge>Menyetir</Badge>}
      {permits.ASSIST && <Badge>Kenek</Badge>}
    </span>
  );
}

function pageHref(filter: EmployeeFilter, page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filter, page })) if (value) params.set(key, String(value));
  return `/karyawan?${params}`;
}

/** KAR-L20 Daftar Karyawan. Saringan dikirim lewat alamat halaman (GET), jadi bisa dibagikan/dimuat ulang. */
export function EmployeeListScreen({ listing, filter }: { listing: EmployeeListing; filter: EmployeeFilter }) {
  const { org } = listing;
  return (
    <div className="space-y-4">
      {listing.mode === 'full' && (
        <Card>
          <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Field id="q" label="Cari">
              <Input id="q" name="q" defaultValue={filter.q ?? ''} placeholder="Nama, kode, atau nomor HP" />
            </Field>
            <Field id="branchId" label="Cabang">
              <Select id="branchId" name="branchId" defaultValue={filter.branchId ?? ''}>
                <option value="">Semua cabang</option>
                {org.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field id="positionId" label="Jabatan">
              <Select id="positionId" name="positionId" defaultValue={filter.positionId ?? ''}>
                <option value="">Semua jabatan</option>
                {org.positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </Field>
            <Field id="workStatus" label="Status kerja">
              <Select id="workStatus" name="workStatus" defaultValue={filter.workStatus ?? ''}>
                <option value="">Semua</option>
                {WORK_STATUSES.map((s) => <option key={s} value={s}>{WORK_STATUS_LABELS[s]}</option>)}
              </Select>
            </Field>
            <Field id="activity" label="Aktif">
              <Select id="activity" name="activity" defaultValue={filter.activity ?? 'active'}>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
                <option value="all">Semua</option>
              </Select>
            </Field>
            <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
              <button type="submit" className="min-h-11 rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">Terapkan</button>
              <Link href="/karyawan" className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm">Hapus saringan</Link>
            </div>
          </form>
        </Card>
      )}

      <p className="text-sm text-ink-muted">{listing.total} orang</p>

      {listing.mode === 'full' ? (
        <DataList<FullRow>
          rows={listing.rows as FullRow[]}
          rowKey={(r) => r.id}
          empty="Tidak ada karyawan yang cocok."
          columns={[
            { key: 'name', header: 'Nama', primary: true, render: (r) => <PersonLink id={r.id} name={r.name} canOpen={r.canOpen} /> },
            { key: 'code', header: 'Kode', render: (r) => r.code },
            { key: 'branch', header: 'Cabang', render: (r) => r.branchName },
            { key: 'position', header: 'Jabatan', render: (r) => r.positionName },
            { key: 'status', header: 'Status kerja', render: (r) => WORK_STATUS_LABELS[r.workStatus] },
            {
              key: 'flags', header: 'Tanda', render: (r) => (
                <span className="flex flex-wrap justify-end gap-1 md:justify-start">
                  {!r.activeToday && <Badge tone="danger">Nonaktif</Badge>}
                  {r.pendingStatus && (
                    <Badge tone="warn">{r.pendingStatus.kind === 'DEACTIVATE' ? 'Akan nonaktif' : 'Akan aktif lagi'}</Badge>
                  )}
                  {r.promotionDueOn && <Badge tone="warn">Training: waktunya dinilai</Badge>}
                  {!r.hasBankAccount && r.activeToday && <Badge>Belum ada rekening</Badge>}
                </span>
              ),
            },
          ]}
        />
      ) : (
        <DataList<DirectoryRow>
          rows={listing.rows as DirectoryRow[]}
          rowKey={(r) => r.id}
          empty="Tidak ada karyawan aktif."
          columns={[
            { key: 'name', header: 'Nama', primary: true, render: (r) => <PersonLink id={r.id} name={r.name} canOpen={r.canOpen} /> },
            { key: 'branch', header: 'Cabang', render: (r) => r.branchName },
            { key: 'position', header: 'Jabatan', render: (r) => r.positionName },
            { key: 'permits', header: 'Izin tugas lapangan', render: (r) => <Permits permits={r.permits} /> },
          ]}
        />
      )}

      {listing.pageCount > 1 && (
        <nav aria-label="Halaman" className="flex items-center justify-between text-sm">
          {listing.page > 1 ? <Link href={pageHref(filter, listing.page - 1)} className="text-brand-700">← Sebelumnya</Link> : <span />}
          <span className="text-ink-muted">Halaman {listing.page} dari {listing.pageCount}</span>
          {listing.page < listing.pageCount ? <Link href={pageHref(filter, listing.page + 1)} className="text-brand-700">Berikutnya →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
