import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Card } from '@/components/ui/surface';
import type { SummaryTotals } from '../rules/off-slip';
import { rupiah } from '../rules/salary';
import type { payrollSummary } from '../server/summary';

type Data = NonNullable<Awaited<ReturnType<typeof payrollSummary>>>;

const FUND_LABELS = { DISCIPLINE: 'Dana Disiplin', ABSENCE: 'Dana Tidak Hadir' } as const;

/** GAJ-L38 Ringkasan Gaji: angka dari slip tersimpan dan pembayarannya. Finance: total perusahaan saja, tanpa dana. */
export function SummaryScreen({ view, total, branches, heldKnown, balanced }: Data) {
  const finance = view === 'FINANCE';
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Ringkasan Gaji</p>
        <NewBadge feature="fitur/ringkasan-gaji" />
      </div>
      {finance && <Alert tone="info">Total seluruh perusahaan, tidak termasuk gaji Pemilik dan GM.</Alert>}
      {view === 'HR' && <Alert tone="info">Tidak termasuk jabatan yang gajinya hanya terlihat Pemilik dan GM.</Alert>}
      {!balanced && <Alert tone="danger">Angka tidak seimbang: pendapatan − terpotong ≠ bersih ≠ dibayar + belum dibayar. Laporkan ke pengembang.</Alert>}
      <Totals totals={total} finance={finance} heldKnown={heldKnown} />
      {branches.length > 0 && (
        <>
          <p className="font-medium">Per cabang</p>
          <p className="text-ink-muted">Cabang yang tersimpan di slip saat ditutup.</p>
          <div className="space-y-2">
            {branches.map((b) => (
              <details key={b.name} className="rounded-md border border-line p-3">
                <summary className="flex cursor-pointer flex-wrap gap-x-4">
                  <b>{b.name}</b>
                  <span>Pendapatan {rupiah(b.totals.incomeTotal)}</span>
                  <span>Terpotong {rupiah(b.totals.takenTotal)}</span>
                  <span>Bersih <b className="tabular-nums">{rupiah(b.totals.net)}</b></span>
                  <span>Belum dibayar {rupiah(b.totals.unpaid)}</span>
                </summary>
                <div className="mt-3"><Totals totals={b.totals} finance={false} heldKnown={heldKnown} /></div>
              </details>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-1">
      <span>{label}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold' : ''}`}>{rupiah(value)}</span>
    </div>
  );
}

function Totals({ totals: t, finance, heldKnown }: { totals: SummaryTotals; finance: boolean; heldKnown: boolean }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <Card className="space-y-1">
        <p className="font-medium">1. Jumlah slip</p>
        <p className="flex flex-wrap gap-x-4">
          <span>{heldKnown ? 'Perkiraan' : 'Perkiraan atau tertahan'}: <b>{t.counts.ESTIMATE}</b></span>
          {heldKnown && <span>Tertahan: <b>{t.counts.HELD}</b></span>}
          <span>Ditutup belum Dibayar: <b>{t.counts.CLOSED}</b></span>
          <span>Dibayar: <b>{t.counts.PAID}</b></span>
        </p>
        <p className="text-ink-muted">Slip Perkiraan dan tertahan tidak dijumlah di bawah.</p>
      </Card>
      <Card className="divide-y divide-line">
        <p className="pb-1 font-medium">2. Pendapatan</p>
        {t.income.map((i) => <Row key={i.label} label={i.label} value={i.amount} />)}
        <Row label="Jumlah pendapatan" value={t.incomeTotal} strong />
      </Card>
      <Card className="divide-y divide-line">
        <p className="pb-1 font-medium">3. Terpotong</p>
        {t.taken.map((g) => <Row key={g.group} label={`(${g.group}) ${g.label}`} value={g.amount} />)}
        <Row label="Jumlah terpotong" value={t.takenTotal} strong />
        <Row label="Sisa dibawa ke slip berikutnya" value={t.carried} />
        <Row label="Piutang Lain yang lahir (slip terakhir)" value={t.receivables} />
        <Row label="Tidak tertagih (slip terakhir)" value={t.uncollectible} />
      </Card>
      {!finance && (
        <Card className="divide-y divide-line">
          <p className="pb-1 font-medium">4. Dana dari slip periode ini</p>
          {t.funds.map((f) => (
            <div key={f.fund} className="flex justify-between gap-3 py-1">
              <span>{FUND_LABELS[f.fund]}</span>
              <span className="tabular-nums">masuk {rupiah(f.in)} · keluar {rupiah(f.out)}</span>
            </div>
          ))}
        </Card>
      )}
      <Card className="divide-y divide-line">
        <p className="pb-1 font-medium">5. Bersih</p>
        <Row label="Jumlah bersih" value={t.net} strong />
        {t.paid.map((p) => <Row key={p.source} label={`Sudah dibayar dari ${p.source}`} value={p.amount} />)}
        <Row label="Belum dibayar" value={t.unpaid} />
        <div className="flex justify-between gap-3 py-1"><span>Slip Rp0 Dibayar tanpa uang</span><span>{t.zero} slip</span></div>
      </Card>
    </div>
  );
}
