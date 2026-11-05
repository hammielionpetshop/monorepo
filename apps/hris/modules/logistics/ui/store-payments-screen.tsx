import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { NewBadge } from '@/components/ui/new-badge';
import { Badge, Card } from '@/components/ui/surface';
import { rupiah } from '../rules/rates';
import type { PaymentMethod } from '../rules/store-payments';
import type { StorePaymentRow } from '../server/store-payments';
import { PaymentCorrectButton } from './payment-correct';

type Totals = { cash: number; transfer: number; left: number; visits: number };
const TONES: Record<PaymentMethod, 'info' | 'ok' | 'warn' | 'danger'> = { NONE: 'info', CASH: 'ok', TRANSFER: 'ok', PARTIAL: 'warn', TEMPO: 'danger' };

/**
 * Uang dari Toko (spec LT1 §13.5 butir 6): cara bayar yang dicatat driver saat Terkirim, per tanggal trip. Hanya daftar
 * untuk Finance; pencatatan ke kasir tetap diketik Finance, pemeriksaan uang menyusul. Janji bayar sisa dan koreksi salah tekan
 * oleh Kepala Gudang / Pemilik / GM (§14.2 butir 4, 5).
 */
export function StorePaymentsScreen({ date, rows, trips, totals, canCorrect }: {
  date: string; rows: StorePaymentRow[]; trips: ({ tripId: number; number: string; crew: string } & Totals)[]; totals: Totals; canCorrect: boolean;
}) {
  return (
    <div className="space-y-4">
      <form action="/logistik/uang-toko" className="flex flex-wrap items-center gap-2">
        <input type="date" name="tanggal" defaultValue={date} className="min-h-9 rounded-lg border border-line bg-surface px-3 text-sm" aria-label="Tanggal trip" />
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">Janji bayar sisa + koreksi cara bayar <NewBadge feature="fitur/janji-bayar" /></span>
      </form>
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><p className="text-sm text-ink-muted">Cash dibawa driver</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.cash)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Transfer (cek mutasi rekening)</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.transfer)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Sisa ditagih kantor</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.left)}</p></Card>
      </div>
      {trips.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Per trip</h2>
          <ul className="divide-y divide-line text-sm">
            {trips.map((t) => (
              <li key={t.tripId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span><Link href={`/logistik/trip/${t.tripId}`} className="font-medium underline">{t.number}</Link> <span className="text-ink-muted">{t.crew} · {t.visits} toko</span></span>
                <span className="tabular-nums">Cash {rupiah(t.cash)} · Transfer {rupiah(t.transfer)} · Sisa {rupiah(t.left)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <DataList
        rows={rows}
        rowKey={(r) => r.id}
        empty="Belum ada cara bayar yang dicatat untuk tanggal ini."
        columns={[
          {
            key: 'store', header: 'Toko', primary: true,
            render: (r) => (
              <span className="inline-flex flex-col">
                <span className="font-medium">{r.store}</span>
                <span className="text-xs text-ink-muted">{r.notes.join(', ')}</span>
              </span>
            ),
          },
          { key: 'trip', header: 'Trip', render: (r) => <span>{r.tripNumber} <span className="text-ink-muted">{r.at}</span></span> },
          {
            key: 'method', header: 'Cara bayar',
            render: (r) => (
              <span className="inline-flex flex-col items-start gap-0.5">
                <Badge tone={TONES[r.method]}>{r.label}</Badge>
                {r.correctionReason && <span className="text-xs text-ink-muted">Dikoreksi: {r.correctionReason}</span>}
              </span>
            ),
          },
          { key: 'bill', header: 'Tagihan', render: (r) => <span className="tabular-nums">{rupiah(r.bill)}</span> },
          { key: 'received', header: 'Diterima', render: (r) => <span className="tabular-nums">{rupiah(r.received)}</span> },
          { key: 'left', header: 'Sisa ditagih', render: (r) => <span className="tabular-nums">{r.left ? rupiah(r.left) : '—'}</span> },
          {
            key: 'promise', header: 'Janji bayar',
            render: (r) => (r.promiseDate ? <span className="tabular-nums">{r.promiseDate}{r.overdue && <> <Badge tone="danger">Lewat janji</Badge></>}</span> : '—'),
          },
          { key: 'proof', header: 'Bukti', render: (r) => (r.proofUrl ? <a href={r.proofUrl} target="_blank" rel="noreferrer" className="underline">Bukti transfer</a> : '—') },
          ...(canCorrect ? [{
            key: 'correct', header: '',
            render: (r: StorePaymentRow) => (r.bill > 0 ? (
              <PaymentCorrectButton target={{
                visitId: r.visitId, tripId: r.tripId, store: r.store, bill: r.bill, method: r.method, received: r.received, promiseDate: r.promiseDate, hasProof: !!r.proofUrl,
              }} />
            ) : null),
          }] : []),
        ]}
      />
    </div>
  );
}
