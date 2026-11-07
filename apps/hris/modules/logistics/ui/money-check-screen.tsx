import Link from 'next/link';
import { NewBadge } from '@/components/ui/new-badge';
import { buttonClass } from '@/components/ui/button';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import type { PosStatus } from '../rules/money-checks';
import { rupiah } from '../rules/rates';
import type { ShortState } from '../rules/short-handovers';
import type { CheckSource, MoneyCheckTab, MoneyPaymentView } from '../server/money-checks';
import type { ShortHandoverView } from '../server/short-handovers';
import { MoneyCheckButton, MoneyCheckVoidButton } from './money-check-actions';
import { ShortSettleButton, ShortSettlementVoidButton } from './short-handover-actions';

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

const SHORT_TONES: Record<ShortState, 'info' | 'ok' | 'warn' | 'danger'> = { OPEN: 'warn', PENDING: 'info', DONE: 'ok', WAIVED: 'info' };
const SHORT_ICONS: Record<ShortState, string> = { OPEN: '⚠️', PENDING: '🕓', DONE: '✅', WAIVED: '—' };
const DEDUCTION_LABELS: Record<string, string> = {
  PENDING: 'menunggu pengesahan', ACTIVE: 'berjalan', REJECTED: 'ditolak', CANCELLED: 'dibatalkan', WAIVED: 'ditiadakan (keberatan)',
};

/** Satu kurang serah (spec B3 butir 4): nota, tindak lanjut, sisa, dan tombolnya. */
function ShortCard({ v }: { v: ShortHandoverView }) {
  const s = v.summary;
  const target = { source: v.source, paymentId: v.paymentId, store: v.store, left: s.left };
  return (
    <li className="space-y-2 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="inline-flex flex-col">
          <span><b>{v.store}</b> · <Link href={v.tripHref} className="underline">{v.tripNumber}</Link></span>
          <span className="text-xs text-ink-muted">Diperiksa {v.on} · atas nama {v.person}</span>
        </span>
        <span className="inline-flex flex-wrap items-center gap-2">
          <Badge tone={v.red ? 'danger' : SHORT_TONES[v.state]}>{SHORT_ICONS[v.state]} {v.stateLabel}{v.red ? ` · ${v.days} hari` : ''}</Badge>
          <span className="tabular-nums font-semibold">−{rupiah(s.total)}</span>
        </span>
      </div>
      <ul className="space-y-1 text-xs text-ink-muted">
        {v.lines.map((l, i) => (
          <li key={i}>{l.number}: lapor {rupiah(l.reported)}, diterima {rupiah(l.actual)}{l.note ? ` · ${l.note}` : ''}</li>
        ))}
      </ul>
      {(v.deductions.length > 0 || v.settlements.length > 0) && (
        <ul className="space-y-1 text-sm">
          {v.deductions.map((d) => (
            <li key={`d${d.id}`} className="flex flex-wrap items-center gap-2">
              <span>Potongan Lain {d.name} <b className="tabular-nums">{rupiah(d.amount)}</b> · {DEDUCTION_LABELS[d.status] ?? d.status}</span>
              <Link href="/potongan/lain" className="text-xs underline">Buka</Link>
            </li>
          ))}
          {v.settlements.map((x) => (
            <li key={`s${x.id}`} className="flex flex-wrap items-center gap-2">
              <span>{x.label}{x.amount != null ? <> <b className="tabular-nums">{rupiah(x.amount)}</b></> : null} · {x.note} · {x.by} {x.on} {x.at}</span>
              {x.proofUrl && <a href={x.proofUrl} target="_blank" rel="noreferrer" className="text-xs underline">Foto bukti</a>}
              {x.canVoid && <ShortSettlementVoidButton id={x.id} label={x.label} />}
            </li>
          ))}
        </ul>
      )}
      {s.left > 0 && s.left !== s.total && <p className="text-sm">Sisa belum ditindaklanjuti: <b className="tabular-nums">{rupiah(s.left)}</b></p>}
      {v.selfProblem ? <p className="text-xs text-ink-muted">{v.selfProblem}</p> : (
        <div className="flex flex-wrap gap-2">
          {v.canPropose && (
            <Link href={`/potongan/lain/ajukan?kurang-serah=${v.source}-${v.paymentId}`} className={buttonClass({ size: 'sm' })}>Jadikan Potongan Lain</Link>
          )}
          {v.canReplace && <ShortSettleButton target={target} kind="CASH_REPLACED" />}
          {v.canWaive && <ShortSettleButton target={target} kind="WAIVED" />}
        </div>
      )}
    </li>
  );
}

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
export function MoneyCheckScreen({ tab, source, from, redDays, trips, diffs, shorts, canCheck, onlyDiff }: {
  tab: MoneyCheckTab; source: 'ALL' | CheckSource; from: string; redDays: number; trips: Group[]; diffs: Diff[]; shorts: ShortHandoverView[];
  canCheck: boolean; onlyDiff: boolean;
}) {
  const href = (t: MoneyCheckTab, s: 'ALL' | CheckSource) => `/logistik/terima-uang?tab=${t}${s !== 'ALL' ? `&sumber=${s}` : ''}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.filter((t) => !onlyDiff || t.key === 'DIFF').map((t) => (
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
      {tab === 'DIFF' && (
        <Card className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">Kurang serah <NewBadge feature="fitur/kurang-serah-tindak-lanjut" /></h2>
          <p className="text-xs text-ink-muted">
            Tunai yang kurang dari laporan, atas nama pembawa uang. Tindak lanjut: <b>Jadikan Potongan Lain</b> (HR mengajukan, Pemilik/GM mengesahkan;
            bisa dibagi dengan kenek), <b>Sudah diganti tunai</b> (Finance), atau <b>Tidak dipotong</b> (Pemilik/GM). Gaji tidak dipotong otomatis.
            Yang belum ditindaklanjuti tetap tampil sampai diurus; lebih dari {redDays} hari ditandai merah.
          </p>
          {shorts.length
            ? <ul className="divide-y divide-line">{shorts.map((v) => <ShortCard key={v.key} v={v} />)}</ul>
            : <p className="text-sm text-ink-muted">Tidak ada kurang serah.</p>}
        </Card>
      )}
      {tab === 'DIFF' ? (
        diffs.length ? (
          <Card className="space-y-2">
            <h2 className="font-semibold">Selisih lain 60 hari terakhir</h2>
            <p className="text-xs text-ink-muted">Lebih serah diputuskan Finance. Transfer kurang tetap ditagih ke toko.</p>
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
        ) : <EmptyState title="Tidak ada selisih lain">Tidak ada lebih serah atau transfer kurang 60 hari terakhir.</EmptyState>
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
