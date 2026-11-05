import Link from 'next/link';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { Alert, Card } from '@/components/ui/surface';
import { rupiahText, type ReportRow } from '../rules/logistics-report';
import type { logisticsReportScreen } from '../server/logistics-report';

type Data = NonNullable<Awaited<ReturnType<typeof logisticsReportScreen>>>;

function queryString(data: Data, extra: Record<string, string>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...data.query, ...extra })) if (v) q.set(k, v);
  return q.toString();
}

/** Laporan Logistik (spec LT1 §17.2): hanya membaca; 6 tab; unduh CSV per tab. */
export function LogisticsReportScreen({ data }: { data: Data }) {
  const csvHref = `/api/logistics/report?${queryString(data, { tab: data.tab })}`;
  const hidden = [!data.parts.fuel && 'bensin', !data.parts.shortage && 'kurang serah'].filter(Boolean).join(' dan ');
  return (
    <div className="space-y-4 text-sm">
      {data.error && <Alert tone="danger">{data.error}</Alert>}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value={data.tab} />
            <Field id="lr-periode" label="Periode 26–25">
              <Select id="lr-periode" name="periode" defaultValue={data.query.periode}>
                {!data.query.periode && <option value="">— pilih periode —</option>}
                {data.periods.map((p) => <option key={p.from} value={p.from}>{p.label}</option>)}
              </Select>
            </Field>
            <Button type="submit" variant="secondary">Tampilkan</Button>
          </form>
          <form method="get" className="flex flex-wrap items-end gap-3">
            <input type="hidden" name="tab" value={data.tab} />
            <Field id="lr-dari" label="Atau tanggal dari">
              <Input id="lr-dari" type="date" name="dari" defaultValue={data.query.dari} required />
            </Field>
            <Field id="lr-sampai" label="Sampai">
              <Input id="lr-sampai" type="date" name="sampai" defaultValue={data.query.sampai} required />
            </Field>
            <Button type="submit" variant="secondary">Tampilkan</Button>
          </form>
          <a className={buttonClass({ variant: 'secondary' })} href={csvHref}>Unduh CSV</a>
        </div>
        <p className="font-medium">Rentang: {data.range.label}</p>
        <p className="text-ink-muted">
          Dasar tanggal: tanggal kirim (tanggal trip / mulai antar sendiri); retur dan laporan barang = tanggal dilaporkan; bensin = tanggal isi.
          Angka uang dari cara bayar yang dicatat awak dan hasil Terima Uang Finance, tanpa piutang — wajar bila berbeda dengan laporan uang kasir/POS
          yang memakai tanggal uang diterima. Ritase dihitung banyaknya, tanpa rupiah. Tanggal bebas paling panjang 3 bulan.
          {hidden && ` Bagian ${hidden} tidak ditampilkan untuk Anda.`} Dibaca jam {data.readAt}.
        </p>
      </Card>
      <nav className="flex flex-wrap gap-2" aria-label="Tab laporan">
        {data.tabs.map((t) => (
          <Link
            key={t.key}
            href={`/logistik/laporan?${queryString(data, { tab: t.key })}`}
            className={buttonClass({ variant: t.key === data.tab ? 'primary' : 'secondary', size: 'sm' })}
            aria-current={t.key === data.tab ? 'page' : undefined}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      {data.table.note && <p className="text-ink-muted">{data.table.note}</p>}
      <DataList<ReportRow & { _i: number }>
        rows={data.table.rows.map((r, i) => ({ ...r, _i: i }))}
        rowKey={(r) => r._i}
        empty="Tidak ada data pengiriman di rentang ini."
        columns={data.table.columns.map((c, i) => ({
          key: c.key, header: c.label, primary: i === 0,
          render: (r) => {
            const v = r[c.key];
            if (c.kind === 'money') return <span className="tabular-nums">{rupiahText(Number(v ?? 0))}</span>;
            if (c.kind === 'count') return <span className="tabular-nums">{String(v ?? 0)}</span>;
            return String(v ?? '');
          },
        }))}
      />
    </div>
  );
}
