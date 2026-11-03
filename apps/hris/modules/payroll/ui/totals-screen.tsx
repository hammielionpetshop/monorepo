import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card } from '@/components/ui/surface';
import { rupiah } from '../rules/salary';
import type { totalsScreen } from '../server/former';

type Data = NonNullable<Awaited<ReturnType<typeof totalsScreen>>>;
type Row = Data['rows'][number];

const money = (v: number) => <span className="tabular-nums">{rupiah(v)}</span>;
const dash = () => <span className="text-ink-muted" title="Slip mingguan dan bongkaran menyusul (driver & kenek)">—</span>;

/** Isi tautan dengan rentang + saringan yang sedang dipakai. */
function queryOf(data: Data): string {
  const q = new URLSearchParams({ dari: data.range.from, sampai: data.range.to });
  for (const [k, v] of Object.entries(data.filter)) if (v) q.set(k, v);
  return q.toString();
}

/** GAJ-L43 Total Diterima per Orang (spec L4g §3.8): satu baris per orang, termasuk mantan karyawan. PC. */
export function TotalsScreen({ data }: { data: Data }) {
  const query = queryOf(data);
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Rentang: {data.range.label} ({data.range.count} periode)</p>
        <NewBadge feature="/gaji/total-diterima" />
      </div>
      {data.view === 'HR' && <Alert tone="info">Tidak termasuk jabatan yang gajinya hanya terlihat Pemilik dan GM.</Alert>}
      <form className="flex flex-wrap items-end gap-3" method="get">
        <Field id="td-dari" label="Dari periode">
          <Select id="td-dari" name="dari" defaultValue={data.range.from}>
            {data.periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
          </Select>
        </Field>
        <Field id="td-sampai" label="Sampai periode">
          <Select id="td-sampai" name="sampai" defaultValue={data.range.to}>
            {data.periods.map((p) => <option key={p.start} value={p.start}>{p.label}</option>)}
          </Select>
        </Field>
        <Field id="td-cabang" label="Cabang (di slip)">
          <Select id="td-cabang" name="cabang" defaultValue={data.filter.cabang}>
            <option value="">Semua</option>
            {data.options.branches.map((b) => <option key={b.id} value={String(b.id)}>{b.name}</option>)}
          </Select>
        </Field>
        <Field id="td-jabatan" label="Jabatan">
          <Select id="td-jabatan" name="jabatan" defaultValue={data.filter.jabatan}>
            <option value="">Semua</option>
            {data.options.positions.map((p) => <option key={p} value={p}>{p}</option>)}
          </Select>
        </Field>
        <Field id="td-status" label="Status">
          <Select id="td-status" name="status" defaultValue={data.filter.status}>
            <option value="">Semua</option>
            <option value="aktif">Aktif</option>
            <option value="mantan">Mantan karyawan</option>
          </Select>
        </Field>
        <Field id="td-cari" label="Cari nama">
          <Input id="td-cari" name="cari" defaultValue={data.filter.cari} maxLength={60} />
        </Field>
        <Button type="submit" variant="secondary">Tampilkan</Button>
        <a className={buttonClass({ variant: 'secondary' })} href={`/api/payroll/totals?${query}`}>Unduh CSV</a>
      </form>
      <p className="text-ink-muted">
        Paling banyak {data.maxPeriods} periode. Dibaca dari slip yang sudah ditutup, pembayarannya, dan bayar di luar slip; slip Perkiraan tidak ikut.
        Slip mingguan dan bongkaran tampil &quot;—&quot; sampai bagian driver &amp; kenek dibangun.
      </p>
      <DataList<Row>
        rows={data.rows}
        rowKey={(r) => r.employeeId}
        empty="Tidak ada slip tertutup atau bayar di luar slip di rentang ini."
        columns={[
          {
            key: 'name', header: 'Orang', primary: true, render: (r) => (
              <span className="flex flex-wrap items-center gap-2">
                <Link className="underline" href={`/gaji/total-diterima/${r.employeeId}?${query}`}>{r.name}</Link>
                {r.former && <Badge tone="warn">Mantan</Badge>}
              </span>
            ),
          },
          { key: 'branch', header: 'Cabang · Jabatan', render: (r) => `${r.branchName} · ${r.positionName}` },
          { key: 'monthly', header: 'Slip bulanan', render: (r) => money(r.slipMonthly) },
          { key: 'weekly', header: 'Slip mingguan', render: dash },
          { key: 'unload', header: 'Bongkaran', render: dash },
          { key: 'off', header: 'Bayar di luar slip', render: (r) => money(r.offSlip) },
          { key: 'received', header: 'Diterima', render: (r) => money(r.received) },
          { key: 'pending', header: 'Belum dibayar', render: (r) => (r.pending ? <b>{money(r.pending)}</b> : money(0)) },
          { key: 'total', header: 'Jumlah', render: (r) => <b>{money(r.total)}</b> },
        ]}
      />
      {data.rows.length > 0 && (
        <Card className="flex flex-wrap gap-x-6 gap-y-1">
          <span>{data.rows.length} orang</span>
          <span>Slip bulanan {money(data.sum.slipMonthly)}</span>
          <span>Bayar di luar slip {money(data.sum.offSlip)}</span>
          <span>Diterima {money(data.sum.received)}</span>
          <span>Belum dibayar {money(data.sum.pending)}</span>
          <span>Jumlah <b>{money(data.sum.total)}</b></span>
        </Card>
      )}
    </div>
  );
}
