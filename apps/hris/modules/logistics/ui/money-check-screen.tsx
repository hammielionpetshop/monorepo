import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import type { PosStatus } from '../rules/money-checks';
import { rupiah } from '../rules/rates';
import type { CheckSource, MoneyCheckTab, MoneyPaymentView } from '../server/money-checks';
import { MoneyCheckButton, MoneyCheckVoidButton } from './money-check-actions';

const TABS: { key: MoneyCheckTab; label: string }[] = [
  { key: 'WAITING', label: 'Belum diperiksa' }, { key: 'DONE', label: 'Sudah diperiksa' }, { key: 'DIFF', label: 'Selisih' },
];
const SOURCES: { key: 'ALL' | CheckSource; label: string }[] = [{ key: 'ALL', label: 'Semua' }, { key: 'TRUCK', label: 'Truk' }, { key: 'SELF', label: 'Antar sendiri' }];
const POS_TONES: Record<PosStatus, 'info' | 'ok' | 'warn' | 'danger'> = { OK: 'ok', PARTLY: 'warn', WAITING: 'warn', GONE: 'danger', UNKNOWN: 'info', NONE: 'info' };
const POS_ICONS: Record<PosStatus, string> = { OK: '✅', PARTLY: '⚠️', WAITING: '⏳', GONE: '⚠️', UNKNOWN: '—', NONE: '—' };

type Group = { key: string; source: CheckSource; tripId: number; number: string; href: string; crew: string; branch: string | null; payments: MoneyPaymentView[] };
type Diff = {
  id: number; number: string; store: string; tripNumber: string; tripHref: string; kind: 'CASH' | 'TRANSFER'; label: string; difference: number;
  note: string | null; person: string | null; on: string;
};

function PaymentCard({ p, tab }: { p: MoneyPaymentView; tab: MoneyCheckTab }) {
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex flex-col">
          <span className="font-medium">{p.store}</span>
          <span className="text-xs text-ink-muted">{p.label} · dicatat {p.on} {p.at}{p.carrier ? ` · pembawa tunai: ${p.carrier}` : ''}</span>
        </span>
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="tabular-nums font-semibold">{p.kindLabel} {rupiah(p.received)}</span>
          {p.red && <Badge tone="danger">lebih dari 3 hari</Badge>}
          {p.proofUrl && <a href={p.proofUrl} target="_blank" rel="noreferrer" className="text-sm underline">Bukti transfer</a>}
          {p.customerUrl && <a href={p.customerUrl} target="_blank" rel="noreferrer" className={buttonClass({ variant: 'ghost', size: 'sm' })}>Piutang di BO</a>}
        </span>
      </div>
      <ul className="space-y-1 text-sm">
        {p.notes.map((n) => (
          <li key={n.transactionId} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-canvas px-3 py-2">
            <span>
              <b>{n.number}</b>{' '}
              <span className="text-ink-muted">{n.bill != null ? `tagihan ${rupiah(n.bill)}` : 'tagihan per nota tidak tercatat'}</span>
            </span>
            {n.check ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <span className="tabular-nums">lapor {rupiah(n.check.reported)}</span>
                {n.check.difference === 0
                  ? <Badge tone="ok">Cocok</Badge>
                  : <Badge tone="danger">Tidak cocok: diterima {rupiah(n.check.actual)}</Badge>}
                {n.pos && n.pos.status !== 'NONE' && (
                  <Badge tone={n.pos.red ? 'danger' : POS_TONES[n.pos.status]}>
                    {POS_ICONS[n.pos.status]} {n.pos.label}{n.pos.paid != null && n.pos.status !== 'OK' ? ` (${rupiah(n.pos.paid)} dari ${rupiah(n.check.posExpected)})` : ''}
                  </Badge>
                )}
              </span>
            ) : (
              <span className="tabular-nums text-ink-muted">{p.splitEditable ? 'dibagi saat diperiksa' : `menurut driver ${rupiah(n.suggested)}`}</span>
            )}
            {n.check?.note && <span className="w-full text-xs text-ink-muted">Catatan: {n.check.note}</span>}
          </li>
        ))}
        {!p.notes.length && <li className="text-xs text-danger-fg">Nota kasir kunjungan ini tidak terbaca; lihat Uang dari Toko.</li>}
      </ul>
      {tab === 'WAITING' && p.canCheck && (p.selfProblem
        ? <p className="text-xs text-ink-muted">{p.selfProblem}</p>
        : (
          <MoneyCheckButton target={{
            source: p.source, paymentId: p.paymentId, store: p.store, kind: p.kind, kindLabel: p.kindLabel, received: p.received, splitEditable: p.splitEditable,
            notes: p.notes.map((n) => ({ transactionId: n.transactionId, number: n.number, bill: n.bill, suggested: n.suggested })),
          }} />
        ))}
      {p.checked && (
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>Diperiksa {p.checked.by} · {p.checked.on} {p.checked.at}</span>
          {p.checked.canVoid && <MoneyCheckVoidButton source={p.source} paymentId={p.paymentId} store={p.store} />}
        </div>
      )}
    </li>
  );
}

/**
 * Terima Uang (spec LT1 §16.1): Finance memeriksa uang trip truk dan antar sendiri per nota. Selisih tunai = kurang serah atas
 * nama pembawa; transfer kurang tetap piutang toko. Pelunasan tetap di BO (Bayar per nota); HRIS hanya menandai sudah masuk POS.
 */
export function MoneyCheckScreen({ tab, source, from, redDays, trips, diffs, canCheck }: {
  tab: MoneyCheckTab; source: 'ALL' | CheckSource; from: string; redDays: number; trips: Group[]; diffs: Diff[]; canCheck: boolean;
}) {
  const href = (t: MoneyCheckTab, s: 'ALL' | CheckSource) => `/logistik/terima-uang?tab=${t}${s !== 'ALL' ? `&sumber=${s}` : ''}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <Link key={t.key} href={href(t.key, source)} className={buttonClass({ variant: tab === t.key ? 'primary' : 'secondary', size: 'sm' })}>{t.label}</Link>
        ))}
        <span className="mx-1 text-ink-muted">·</span>
        {SOURCES.map((s) => (
          <Link key={s.key} href={href(tab, s.key)} className={buttonClass({ variant: source === s.key ? 'primary' : 'ghost', size: 'sm' })}>{s.label}</Link>
        ))}
      </div>
      {tab === 'WAITING' && (
        <Alert tone="info">
          Cocokkan uang tiap nota dengan laporan driver. Sesudah itu lunasi di BO memakai <b>Bayar per nota</b> (bukan bayar gabungan), supaya tanda
          pelunasan POS cocok. Daftar sejak {from}; lebih dari {redDays} hari ditandai merah.{!canCheck && ' Anda hanya bisa melihat.'}
        </Alert>
      )}
      {tab === 'DIFF' ? (
        diffs.length ? (
          <Card className="space-y-2">
            <h2 className="font-semibold">Selisih 60 hari terakhir</h2>
            <p className="text-xs text-ink-muted">Kurang serah = bahan Potongan Lain HR (tidak memotong gaji otomatis). Lebih serah diputuskan Finance. Transfer kurang tetap ditagih ke toko.</p>
            <ul className="divide-y divide-line text-sm">
              {diffs.map((d) => (
                <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="inline-flex flex-col">
                    <span><b>{d.number}</b> · {d.store} · <Link href={d.tripHref} className="underline">{d.tripNumber}</Link></span>
                    <span className="text-xs text-ink-muted">{d.on}{d.person ? ` · atas nama ${d.person}` : ''}{d.note ? ` · ${d.note}` : ''}</span>
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Badge tone={d.difference > 0 ? 'warn' : 'danger'}>{d.label}</Badge>
                    <span className="tabular-nums font-semibold">{d.difference > 0 ? '+' : '−'}{rupiah(Math.abs(d.difference))}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ) : <EmptyState title="Tidak ada selisih">Semua uang yang diperiksa 60 hari terakhir cocok.</EmptyState>
      ) : trips.length ? (
        trips.map((g) => (
          <Card key={g.key} className="space-y-1">
            <h2 className="font-semibold">
              <Link href={g.href} className="underline">{g.number}</Link>{' '}
              <span className="text-sm font-normal text-ink-muted">{g.source === 'SELF' ? `Antar sendiri${g.branch ? ` · ${g.branch}` : ''} · ` : ''}{g.crew}</span>
            </h2>
            <ul className="divide-y divide-line">
              {g.payments.map((p) => <PaymentCard key={p.key} p={p} tab={tab} />)}
            </ul>
          </Card>
        ))
      ) : (
        <EmptyState title={tab === 'WAITING' ? 'Tidak ada uang yang menunggu diperiksa' : 'Belum ada yang diperiksa 30 hari terakhir'} />
      )}
    </div>
  );
}
