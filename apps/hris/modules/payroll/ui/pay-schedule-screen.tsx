'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { NewBadge } from '@/components/ui/new-badge';
import { Alert, Badge, Card, EmptyState } from '@/components/ui/surface';
import type { payScheduleScreen } from '../server/payment';
import { rupiah } from '../rules/salary';

type Data = NonNullable<Awaited<ReturnType<typeof payScheduleScreen>>>;

const TONE = { LATE: 'danger', TODAY: 'warn', WEEK: 'info', LATER: 'info' } as const;

/** GAJ-L33 Jadwal Bayar: tiga angka, kelompok per periode yang bisa dibuka, centang lalu Bayar terpilih. Finance: jumlah tanpa nama. */
export function PayScheduleScreen({ payer, groups, totals, outside, testMode, canTransfer }: Data) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState<Set<string>>(new Set(groups.filter((g) => g.bucket === 'LATE' || g.bucket === 'TODAY').map((g) => g.period)));
  const all = groups.flatMap((g) => g.rows);
  const pickedRows = all.filter((r) => picked.has(r.slipId));
  const toggle = (ids: number[], on: boolean) => setPicked((prev) => {
    const next = new Set(prev);
    for (const id of ids) if (on) next.add(id); else next.delete(id);
    return next;
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Lewat" {...totals.LATE} tone="danger" />
        <Stat label="Hari ini" {...totals.TODAY} tone="warn" />
        <Stat label="7 hari ke depan" {...totals.WEEK} tone="info" />
      </div>
      {testMode && <Alert tone="warn">Mode uji staging: jatuh bayar dianggap hari slip ditutup, supaya Jadwal Bayar dan pengingat bisa dicoba esok harinya.</Alert>}
      {payer && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md bg-surface py-2">
          <Button disabled={!pickedRows.length} onClick={() => router.push(`/gaji/bayar?slip=${pickedRows.map((r) => r.slipId).join(',')}`)}>
            Bayar terpilih ({pickedRows.length}, {rupiah(pickedRows.reduce((s, r) => s + r.net, 0))})
          </Button>
          {picked.size > 0 && <Button variant="ghost" onClick={() => setPicked(new Set())}>Kosongkan pilihan</Button>}
        </div>
      )}
      <OutsideCard payer={payer} outside={outside} />
      {!groups.length && !outside.waitingCount && <EmptyState title="Tidak ada yang perlu dibayar">Semua slip yang ditutup sudah ditandai Dibayar.</EmptyState>}
      {groups.map((g) => {
        const payable = g.rows.filter((r) => !r.ownSlip);
        const allPicked = payable.length > 0 && payable.every((r) => picked.has(r.slipId));
        const isOpen = open.has(g.period);
        return (
          <Card key={g.period} className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium">Slip {g.label}</p>
              {g.bucket && <Badge tone={TONE[g.bucket]}>{g.bucketLabel}{g.daysLate ? ` ${g.daysLate} hari` : ''}</Badge>}
            </div>
            {g.count > 0 && <p>{g.count} slip · <b className="tabular-nums">{rupiah(g.amount)}</b> · jatuh bayar {g.due} · belum ditandai Dibayar</p>}
            {g.notYetClosed > 0 && (
              <p className="text-ink-muted">{g.notYetClosed} slip belum bisa dibayar: masih Perkiraan atau tertahan · <Link className="underline" href={`/gaji/periode/${g.period}`}>Buka periode</Link></p>
            )}
            <div className="flex flex-wrap gap-2">
              {payer && g.rows.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => setOpen((prev) => { const n = new Set(prev); if (isOpen) n.delete(g.period); else n.add(g.period); return n; })}>
                  {isOpen ? 'Tutup daftar' : `Lihat ${g.rows.length} orang`}
                </Button>
              )}
              {payer && payable.length > 0 && (
                <Button variant="secondary" size="sm" onClick={() => toggle(payable.map((r) => r.slipId), !allPicked)}>{allPicked ? 'Batal pilih semua' : 'Pilih semua'}</Button>
              )}
              {canTransfer && g.count > 0 && <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} href={`/gaji/periode/${g.period}/transfer`}>Daftar Transfer</Link>}
            </div>
            {payer && isOpen && (
              <ul className="divide-y divide-line">
                {g.rows.map((r) => (
                  <li key={r.slipId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <label className="flex min-h-11 items-center gap-2">
                      <input type="checkbox" className="h-5 w-5" disabled={r.ownSlip} checked={picked.has(r.slipId)} onChange={(e) => toggle([r.slipId], e.target.checked)} aria-label={`Pilih ${r.name}`} />
                      <Link className="underline" href={`/gaji/slip/${r.slipId}`}>{r.name}</Link>
                    </label>
                    <span className="text-ink-muted">{r.branchName}</span>
                    <b className="tabular-nums">{rupiah(r.net)}</b>
                    {r.account ? <span className="text-ink-muted">rek. {r.account}</span> : <Badge tone="warn">Belum ada rekening</Badge>}
                    {r.ownSlip && <span className="text-ink-muted">slip Anda sendiri: dibayar pemilik lain atau GM</span>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

/** Bayar di luar slip (L4f-2, GAJ-L37): tagihan bonus susulan / koreksi plus untuk orang yang slip terakhirnya sudah Dibayar. */
function OutsideCard({ payer, outside }: { payer: boolean; outside: Data['outside'] }) {
  if (!outside.waitingCount && !outside.paid.length) return null;
  return (
    <Card className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Bayar di luar slip</p>
        <NewBadge feature="fitur/bayar-luar-slip" />
      </div>
      <p>{outside.waitingCount} tagihan menunggu · <b className="tabular-nums">{rupiah(outside.waitingTotal)}</b>{payer ? '' : ' (tanpa nama)'}</p>
      <p className="text-ink-muted">Bonus Disahkan atau koreksi plus untuk orang yang slip terakhirnya sudah Dibayar. Saat dibayar, dipotongkan ke Piutang Lain orang itu lebih dulu; sisanya dengan uang.</p>
      {payer && outside.waiting.length > 0 && (
        <ul className="divide-y divide-line">
          {outside.waiting.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="font-medium">{c.name}</span>
              <span className="text-ink-muted">{c.branchName}</span>
              <span>{c.label}</span>
              <b className="tabular-nums">{rupiah(c.amount)}</b>
              {c.ownClaim ? <span className="text-ink-muted">tagihan Anda sendiri: dibayar pemilik lain atau GM</span>
                : <Link className={buttonClass({ size: 'sm' })} href={`/gaji/luar-slip/${c.id}/bayar`}>Bayar</Link>}
            </li>
          ))}
        </ul>
      )}
      {payer && outside.paid.length > 0 && (
        <details>
          <summary className="cursor-pointer">Sudah dibayar di luar slip ({outside.paid.length} terakhir)</summary>
          <ul className="divide-y divide-line">
            {outside.paid.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                <span>{c.name}</span><span>{c.label}</span><b className="tabular-nums">{rupiah(c.amount)}</b>
                {c.paid && <span className="text-ink-muted">{c.paid.settled ? `${rupiah(c.paid.settled)} dipotong piutang · ` : ''}{c.paid.cash ? `${rupiah(c.paid.cash)} uang · ` : ''}{c.paid.moneyDate} · {c.paid.by}</span>}
                {c.canCancel && <Link className={buttonClass({ variant: 'ghost', size: 'sm' })} href={`/gaji/luar-slip/${c.id}/batal-bayar`}>Batal bayar</Link>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function Stat({ label, count, amount, tone }: { label: string; count: number; amount: number; tone: 'danger' | 'warn' | 'info' }) {
  return (
    <Card className="space-y-1 text-sm">
      <Badge tone={tone}>{label}</Badge>
      <p className="text-lg font-semibold tabular-nums">{rupiah(amount)}</p>
      <p className="text-ink-muted">{count} slip</p>
    </Card>
  );
}
