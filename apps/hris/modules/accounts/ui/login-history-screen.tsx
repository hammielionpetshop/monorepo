import Link from 'next/link';
import { DataList } from '@/components/ui/data-list';
import { Field, Input, Select } from '@/components/ui/field';
import { Badge, Card } from '@/components/ui/surface';
import { APP_LABELS, METHOD_LABELS, OUTCOME_LABELS } from '../rules/accounts';
import type { LoginHistoryData, LoginHistoryFilter } from '../server/accounts';

const dateTime = new Intl.DateTimeFormat('id-ID', {
  timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

function pageHref(filter: LoginHistoryFilter, range: { from: string; to: string }, page: number) {
  const params = new URLSearchParams({ from: range.from, to: range.to, page: String(page) });
  if (filter.accountId) params.set('accountId', String(filter.accountId));
  if (filter.outcome) params.set('outcome', filter.outcome);
  return `/riwayat-masuk?${params}`;
}

/** KAR-L40 Riwayat Masuk Semua Orang. Saringan lewat alamat halaman (GET). */
export function LoginHistoryScreen({ data, filter }: { data: LoginHistoryData; filter: LoginHistoryFilter }) {
  const lastPage = Math.max(1, Math.ceil(data.total / data.pageSize));
  return (
    <div className="space-y-4">
      <Card>
        <form method="get" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field id="accountId" label="Orang">
            <Select id="accountId" name="accountId" defaultValue={filter.accountId ?? ''}>
              <option value="">Semua orang</option>
              {data.accountOptions.map((a) => <option key={a.accountId} value={a.accountId}>{a.label}</option>)}
            </Select>
          </Field>
          <Field id="outcome" label="Hasil">
            <Select id="outcome" name="outcome" defaultValue={filter.outcome ?? ''}>
              <option value="">Semua</option>
              <option value="SUCCESS">Berhasil</option>
              <option value="REJECTED">Ditolak</option>
            </Select>
          </Field>
          <Field id="from" label="Dari tanggal">
            <Input id="from" name="from" type="date" defaultValue={data.range.from} />
          </Field>
          <Field id="to" label="Sampai tanggal">
            <Input id="to" name="to" type="date" defaultValue={data.range.to} />
          </Field>
          <div className="flex items-end">
            <button type="submit" className="min-h-11 w-full rounded-lg bg-brand-600 px-4 text-sm font-medium text-white hover:bg-brand-700">
              Tampilkan
            </button>
          </div>
        </form>
      </Card>
      <p className="text-sm text-ink-muted">{data.total} catatan. Ditolak = salah password/PIN, akun terkunci, atau akun nonaktif.</p>
      <DataList
        rows={data.rows}
        rowKey={(row) => row.id}
        empty="Tidak ada catatan masuk pada rentang ini."
        columns={[
          { key: 'at', header: 'Kapan', primary: true, render: (row) => dateTime.format(new Date(row.at)) },
          {
            key: 'who', header: 'Siapa',
            render: (row) => <span>{row.who}{row.identifier && row.identifier !== row.who && <span className="text-ink-muted"> · {row.identifier}</span>}</span>,
          },
          { key: 'app', header: 'Aplikasi', render: (row) => `${APP_LABELS[row.appCode] ?? row.appCode} · ${METHOD_LABELS[row.authMethod] ?? row.authMethod}` },
          {
            key: 'outcome', header: 'Hasil',
            render: (row) => <Badge tone={row.outcome === 'SUCCESS' ? 'ok' : 'danger'}>{OUTCOME_LABELS[row.outcome] ?? row.outcome}</Badge>,
          },
          { key: 'device', header: 'Perangkat', render: (row) => <span className="line-clamp-2 break-all text-xs">{row.deviceLabel ?? '—'}</span> },
        ]}
      />
      {lastPage > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Halaman">
          {data.page > 1 ? <Link href={pageHref(filter, data.range, data.page - 1)} className="text-brand-700 hover:underline">← Sebelumnya</Link> : <span />}
          <span className="text-ink-muted">Halaman {data.page} dari {lastPage}</span>
          {data.page < lastPage ? <Link href={pageHref(filter, data.range, data.page + 1)} className="text-brand-700 hover:underline">Berikutnya →</Link> : <span />}
        </nav>
      )}
    </div>
  );
}
