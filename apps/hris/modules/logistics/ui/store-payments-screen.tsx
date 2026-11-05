import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { NewBadge } from '@/components/ui/new-badge';
import { Badge, Card } from '@/components/ui/surface';
import { rupiah } from '../rules/rates';
import type { PaymentMethod } from '../rules/store-payments';
import type { PaymentSourceFilter, PaymentTripSummary, StorePaymentRow } from '../server/store-payments';
import { PaymentCorrectButton } from './payment-correct';

type Totals = { cash: number; transfer: number; left: number; visits: number; cashTruck: number; cashSelf: number };
const TONES: Record<PaymentMethod, 'info' | 'ok' | 'warn' | 'danger'> = { NONE: 'info', CASH: 'ok', TRANSFER: 'ok', PARTIAL: 'warn', TEMPO: 'danger' };
const SOURCES: { key: PaymentSourceFilter; label: string }[] = [
  { key: 'ALL', label: 'Semua' }, { key: 'TRUCK', label: 'Truk' }, { key: 'SELF', label: 'Antar sendiri' },
];
const selectClass = 'min-h-9 rounded-lg border border-line bg-surface px-3 text-sm';

/**
 * Uang dari Toko (spec LT1 §13.5 butir 6, §15.4 butir 1): cara bayar yang dicatat driver truk dan pengantar antar sendiri saat
 * Terkirim, per tanggal. Hanya daftar untuk Finance; pencatatan ke kasir tetap diketik Finance, pemeriksaan uang menyusul.
 * Tunai truk dibawa driver; tunai antar sendiri masuk laci cabang. Janji bayar sisa dan koreksi salah tekan (§14.2, §15.4).
 */
export function StorePaymentsScreen({ date, rows, trips, totals, source, branchId, branches }: {
  date: string; rows: StorePaymentRow[]; trips: PaymentTripSummary[]; totals: Totals; source: PaymentSourceFilter; branchId: number | null;
  branches: { id: number; name: string }[];
}) {
  return (
    <div className="space-y-4">
      <form action="/logistik/uang-toko" className="flex flex-wrap items-center gap-2">
        <input type="date" name="tanggal" defaultValue={date} className={selectClass} aria-label="Tanggal" />
        <select name="sumber" defaultValue={source} className={selectClass} aria-label="Sumber">
          {SOURCES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <select name="cabang" defaultValue={branchId ?? ''} className={selectClass} aria-label="Cabang antar sendiri">
          <option value="">Semua cabang</option>
          {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button type="submit" className={buttonClass({ variant: 'secondary', size: 'sm' })}>Tampilkan</button>
        <span className="inline-flex items-center gap-1 text-xs text-ink-muted">Antar sendiri ikut di sini <NewBadge feature="fitur/uang-toko-antar-sendiri" /></span>
      </form>
      {branchId != null && <p className="text-xs text-ink-muted">Saringan cabang hanya berlaku untuk antar sendiri; trip truk disembunyikan.</p>}
      <div className="grid gap-3 sm:grid-cols-4">
        <Card><p className="text-sm text-ink-muted">Cash dibawa driver truk</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.cashTruck)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Tunai antar sendiri (ke laci cabang)</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.cashSelf)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Transfer (cek mutasi rekening)</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.transfer)}</p></Card>
        <Card><p className="text-sm text-ink-muted">Sisa ditagih kantor</p><p className="text-lg font-semibold tabular-nums">{rupiah(totals.left)}</p></Card>
      </div>
      {trips.length > 0 && (
        <Card className="space-y-2">
          <h2 className="font-semibold">Per trip / perjalanan</h2>
          <ul className="divide-y divide-line text-sm">
            {trips.map((t) => (
              <li key={t.key} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <Link href={t.href} className="font-medium underline">{t.number}</Link>{' '}
                  <span className="text-ink-muted">{t.source === 'SELF' ? 'Antar sendiri · ' : ''}{t.crew} · {t.visits} {t.source === 'SELF' ? 'tujuan' : 'toko'}</span>
                  {t.running && <> <Badge tone="warn">belum kembali</Badge></>}
                  {t.cashReceived === true && <> <Badge tone="ok">tunai diterima laci</Badge></>}
                  {t.cashReceived === false && <> <Badge tone="danger">tunai belum diterima laci</Badge></>}
                </span>
                <span className="tabular-nums">{t.source === 'SELF' ? 'Tunai' : 'Cash'} {rupiah(t.cash)} · Transfer {rupiah(t.transfer)} · Sisa {rupiah(t.left)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <DataList
        rows={rows}
        rowKey={(r) => r.key}
        empty="Belum ada cara bayar yang dicatat untuk tanggal ini."
        columns={[
          {
            key: 'store', header: 'Toko / tujuan', primary: true,
            render: (r) => (
              <span className="inline-flex flex-col">
                <span className="font-medium">{r.store}</span>
                <span className="text-xs text-ink-muted">{r.notes.join(', ')}</span>
              </span>
            ),
          },
          {
            key: 'trip', header: 'Trip',
            render: (r) => (
              <span className="inline-flex flex-col">
                <span>{r.tripNumber} <span className="text-ink-muted">{r.at}</span></span>
                {r.source === 'SELF' && <span className="text-xs text-ink-muted">Antar sendiri · {r.crew}{r.branch ? ` · ${r.branch}` : ''}</span>}
              </span>
            ),
          },
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
          {
            key: 'correct', header: '',
            render: (r) => (r.canCorrect ? (
              <PaymentCorrectButton target={{
                visitId: r.visitId, selfStopId: r.stopId, tripId: r.tripId, store: r.store, bill: r.bill, method: r.method, received: r.received,
                promiseDate: r.promiseDate, hasProof: !!r.proofUrl,
                cashNote: r.source === 'SELF' ? 'Bila koreksi mengubah jumlah tunai dan tunainya sudah diterima laci, penerimaan dibuka lagi dan laci harus menekan Sudah diterima ulang.' : null,
              }} />
            ) : null),
          },
        ]}
      />
    </div>
  );
}
