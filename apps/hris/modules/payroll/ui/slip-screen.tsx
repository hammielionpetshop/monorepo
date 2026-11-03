import Link from 'next/link';
import { buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Card } from '@/components/ui/surface';
import type { SlipView } from '../server/payslip';
import type { slipExtras } from '../server/payslip-reopen';
import type { slipPayment } from '../server/payment';
import type { SlipHold } from '../rules/payslip';
import { longDate, rupiah } from '../rules/salary';
import { SlipDocument } from './slip-document';

const timeFormat = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' });

type Extras = NonNullable<Awaited<ReturnType<typeof slipExtras>>>;
type Payment = Awaited<ReturnType<typeof slipPayment>>;

const STEP_LABELS: Record<string, string> = {
  CLOSE: 'Ditutup', EARLY_CLOSE: 'Ditutup lebih cepat', REOPEN: 'Dibuka kembali', REOPEN_REQUEST: 'Diminta buka kembali', PRINT: 'Dicetak',
  PAY: 'Dibayar', PAY_CANCEL: 'Pembayaran dibatalkan', PAY_ZERO: 'Dibayar tanpa uang',
};

/** GAJ-L29 Slip: bentuk slip, kotak penahan, dan tombol menurut keadaan (L4e-2: buka kembali, tutup lebih cepat, riwayat versi). */
export function SlipScreen({ slip, holds, window: win, computedAt, can, closeBlocked, extras, payment = null }: {
  slip: SlipView; holds: SlipHold[]; window: { opensText: string; testMode: boolean }; computedAt: string;
  can: { close: boolean; print: boolean }; closeBlocked: string | null; extras: Extras | null; payment?: Payment;
}) {
  const uncollectible = slip.deductions.filter((g) => g.group === 'a' || g.group === 'd').flatMap((g) => g.lines).reduce((s, l) => s + l.remaining, 0);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/periode/${slip.period.start}`}>Kembali ke periode</Link>
        {can.close && <Link className={buttonClass({})} href={`/gaji/periode/${slip.period.start}/tutup?slip=${slip.slipId}`}>Tutup slip</Link>}
        {extras?.can.earlyClose && (
          <span className="flex items-center gap-1">
            <Link className={buttonClass({ variant: can.close ? 'secondary' : 'primary' })} href={`/gaji/slip/${slip.slipId}/tutup-cepat`}>Tutup lebih cepat</Link>
            <NewBadge feature="fitur/tutup-lebih-cepat" />
          </span>
        )}
        {payment?.can.pay && (
          <span className="flex items-center gap-1">
            <Link className={buttonClass({})} href={`/gaji/bayar?slip=${slip.slipId}&kembali=slip`}>Bayar</Link>
            <NewBadge feature="fitur/bayar-slip" />
          </span>
        )}
        {payment?.can.cancel && <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/slip/${slip.slipId}/batal-bayar`}>Batal bayar</Link>}
        {can.print && <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/slip/${slip.slipId}/cetak`} target="_blank">Cetak</Link>}
        {(extras?.can.reopen || extras?.can.requestReopen) && (
          <span className="flex items-center gap-1">
            <Link className={buttonClass({ variant: 'secondary' })} href={`/gaji/slip/${slip.slipId}/buka`}>{extras.can.reopen ? 'Buka kembali' : 'Minta buka kembali'}</Link>
            <NewBadge feature="fitur/buka-kembali-slip" />
          </span>
        )}
        {extras?.pendingRequestId && <Link className={buttonClass({ variant: 'ghost' })} href={`/persetujuan/${extras.pendingRequestId}`}>Permintaan buka kembali menunggu</Link>}
        <Link className={buttonClass({ variant: 'ghost' })} href={`/gaji/${slip.employeeId}`}>Gaji {slip.name}</Link>
      </div>
      {slip.status === 'ESTIMATE' && closeBlocked && !holds.length && !extras?.can.earlyClose && <Alert tone="info">{closeBlocked}</Alert>}
      {extras?.reopenBlock && <Alert tone="info">Belum bisa dibuka kembali: {extras.reopenBlock}</Alert>}
      {extras?.earlyBlock && <Alert tone="info">{extras.earlyBlock}</Alert>}
      {win.testMode && slip.status === 'ESTIMATE' && <Alert tone="warn">Mode uji staging: Tutup boleh sebelum {win.opensText}.</Alert>}
      {holds.length > 0 && (
        <Alert tone="warn" title="Slip ini tertahan">
          <ul className="mt-1 space-y-1">
            {holds.map((h) => (
              <li key={h.kind}>{h.text} · penyelesai {h.resolver} · <Link className="underline" href={h.link}>Buka urusannya</Link></li>
            ))}
          </ul>
          <p className="mt-1">Tidak ada tutup paksa: slip ditutup begitu urusannya diputuskan.</p>
        </Alert>
      )}
      {extras?.lastSlip && (
        <Alert tone="info" title="Slip terakhir">
          <ul className="mt-1 space-y-1">
            {extras.lastWorkingDay && <li>Dihitung sampai hari terakhir bekerja ({longDate(extras.lastWorkingDay)} dikurangi sehari). Seluruh sisa cicilan Potongan Lain ikut di slip ini.</li>}
            {extras.withoutNotice && <li>Berhenti tanpa pemberitahuan: bonus yang belum masuk slip Hangus, bersih yang tersisa menjadi denda (diterima Rp0).</li>}
            <li>Sisa telat/tidak hadir/denda yang tidak tertampung = Tidak tertagih{slip.status === 'CLOSED' ? `: ${rupiah(uncollectible)}` : ''}. Sisa kehilangan, minus kas, dan Potongan Lain = Piutang Lain.</li>
            {extras.receivables.map((r) => (
              <li key={r.id}>Piutang Lain {r.groupLabel}: <b className="tabular-nums">{rupiah(r.amount)}</b> · {r.statusLabel} · <Link className="underline" href="/gaji/piutang">Piutang Lain</Link></li>
            ))}
          </ul>
        </Alert>
      )}
      {payment && <PaymentBox payment={payment} />}
      <Card>
        {slip.status === 'ESTIMATE' && <p className="mb-3 text-xs text-ink-muted">Perkiraan dihitung pukul {timeFormat.format(new Date(computedAt))}.</p>}
        <SlipDocument slip={slip} />
      </Card>
      {extras && extras.versions.steps.some((s) => s.action !== 'PRINT') && (
        <Card className="space-y-2 text-sm">
          <p className="font-medium">Riwayat versi</p>
          <ul className="space-y-1">
            {extras.versions.steps.filter((s) => s.action !== 'PRINT').map((s) => (
              <li key={s.id}>
                <b>{STEP_LABELS[s.action] ?? s.action}</b>{s.version != null ? ` versi ${s.version}` : ''} · {s.at} · {s.by}
                {s.net != null && s.action !== 'REOPEN_REQUEST' ? ` · bersih ${rupiah(s.net)}` : ''}
                {s.reason ? <span className="text-ink-muted"> · {s.reason}</span> : null}
                {s.requestId ? <> · <Link className="underline" href={`/persetujuan/${s.requestId}`}>pengajuan</Link></> : null}
              </li>
            ))}
          </ul>
          {extras.versions.replacedVersions.length > 0 && <p className="text-ink-muted">Baris versi {extras.versions.replacedVersions.join(', ')} tersimpan sebagai riwayat (diganti).</p>}
        </Card>
      )}
    </div>
  );
}

/** Kotak Pembayaran di layar Slip (spec L4f §4). */
function PaymentBox({ payment }: { payment: NonNullable<Payment> }) {
  const p = payment.paid;
  return (
    <Card className="space-y-2 text-sm">
      <p className="flex items-center gap-1 font-medium">Pembayaran <NewBadge feature="fitur/bayar-slip" /></p>
      {p?.kind === 'NO_MONEY' && <p>Dibayar tanpa uang: bersih Rp0, seluruhnya terpakai potongan.</p>}
      {p?.kind === 'MONEY' && (
        <ul className="space-y-1">
          <li>Dibayar <b className="tabular-nums">{rupiah(p.amount)}</b> tanggal uang {p.moneyDate} dari {p.source} ({p.method})</li>
          <li className="text-ink-muted">Ditandai {p.by} · {p.recordedAt}{p.dateReason ? ` · alasan tanggal mundur: ${p.dateReason}` : ''}</li>
          <li>{p.hasProof ? <a className="underline" href={`/api/payroll/payments/${p.id}/proof`} target="_blank" rel="noreferrer">Lihat foto bukti</a> : <span className="text-ink-muted">Tanpa foto bukti</span>}</li>
        </ul>
      )}
      {!p && <p>Belum Dibayar · jatuh bayar {payment.due}</p>}
      {payment.history.length > 0 && (
        <ul className="space-y-1 text-ink-muted">
          {payment.history.map((h) => (
            <li key={h.id}>Dibatalkan: {rupiah(h.amount)} tanggal uang {h.moneyDate} ({h.by}) · dibatalkan {h.cancelled?.by} {h.cancelled?.at}: {h.cancelled?.reason}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
