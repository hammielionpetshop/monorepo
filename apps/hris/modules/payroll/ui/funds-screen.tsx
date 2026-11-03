'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { DataList } from '@/components/ui/data-list';
import { Alert, Badge, Card } from '@/components/ui/surface';
import type { FundState } from '../rules/funds';
import { longDate, rupiah } from '../rules/salary';

type LedgerRow = { id: number; kind: string; kindLabel: string; amount: number; balance: number; reason: string; at: string; by: string | null; periodStart: string | null };
type BranchEstimate = { branchName: string; people: number; disciplineIn: number; absenceIn: number; absenceOut: number };
type Tab = 'discipline' | 'absence';

const signed = (n: number) => (n < 0 ? `−${rupiah(-n)}` : `+${rupiah(n)}`);
const when = (iso: string) => new Date(iso).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'medium', timeStyle: 'short' });

function Ledger({ rows, empty }: { rows: LedgerRow[]; empty: string }) {
  return (
    <DataList
      rows={rows}
      rowKey={(r) => String(r.id)}
      empty={empty}
      columns={[
        { key: 'at', header: 'Kapan', primary: true, render: (r) => `${when(r.at)} · ${r.kindLabel}` },
        { key: 'amount', header: 'Mutasi', render: (r) => <b className="tabular-nums">{signed(r.amount)}</b> },
        { key: 'balance', header: 'Saldo', render: (r) => <span className="tabular-nums">{rupiah(r.balance)}</span> },
        { key: 'reason', header: 'Alasan', render: (r) => <span>{r.reason}{r.by ? <span className="text-ink-muted"> · {r.by}</span> : null}</span> },
      ]}
    />
  );
}

function Stat({ label, value, hint }: { label: string; value: number; hint?: string }) {
  return (
    <Card>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{value < 0 ? `−${rupiah(-value)}` : rupiah(value)}</p>
      {hint && <p className="text-xs text-ink-muted">{hint}</p>}
    </Card>
  );
}

/** GAJ-L24 Dana Disiplin dan GAJ-L25 Dana Tidak Hadir (spec L4d §3.4, §9 butir 2). */
export function FundsScreen(props: {
  state: FundState; period: { start: string; label: string };
  estimate: { branches: BranchEstimate[]; total: { disciplineIn: number; absenceIn: number; absenceOut: number } };
  ledger: { discipline: LedgerRow[]; absence: LedgerRow[] };
  reserved: { id: number; name: string | null; occurredOn: string; periodStart: string; amount: number; label: string }[];
  note: string; can: { manage: boolean }; initialTab: Tab;
}) {
  const { state, period, estimate, ledger, reserved, can } = props;
  const [tab, setTab] = useState<Tab>(props.initialTab);
  const href = (kind: string, fund?: string) => `/dana/ubah?jenis=${kind}${fund ? `&dana=${fund}` : ''}`;
  const estimateNote = <Badge tone="warn">perkiraan, belum masuk saldo</Badge>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={tab === 'discipline' ? 'primary' : 'secondary'} onClick={() => setTab('discipline')}>Dana Disiplin</Button>
        <Button size="sm" variant={tab === 'absence' ? 'primary' : 'secondary'} onClick={() => setTab('absence')}>Dana Tidak Hadir</Button>
      </div>

      {tab === 'discipline' && (
        <div className="space-y-4">
          <Alert tone="info">
            Potongan telat dan denda kehadiran masuk Dana Disiplin perusahaan saat slip ditutup. Dana ini membayar bonus yang sumbernya Dana Disiplin.
            Bonus bersumber Dana Disiplin hanya bisa disahkan sebesar yang Tersedia.
          </Alert>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Saldo" value={state.discipline.balance} hint="Jumlah semua mutasi" />
            <Stat label="Terpesan" value={state.discipline.reserved} hint="Bonus disahkan yang belum masuk slip ditutup" />
            <Stat label="Tersedia" value={state.discipline.available} hint="Saldo − Terpesan" />
          </div>
          {can.manage && (
            <div className="flex flex-wrap gap-2">
              {!state.discipline.hasEntries && <Link className={buttonClass({ size: 'sm' })} href={href('OPENING', 'DISCIPLINE')}>Isi saldo awal</Link>}
              <Link className={buttonClass({ size: 'sm', variant: 'secondary' })} href={href('ADJUSTMENT', 'DISCIPLINE')}>Sesuaikan</Link>
            </div>
          )}
          <Card className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Periode berjalan {period.label}</h2>{estimateNote}</div>
            <DataList
              rows={estimate.branches}
              rowKey={(b) => b.branchName}
              empty="Belum ada hitungan kehadiran di periode ini."
              columns={[
                { key: 'branch', header: 'Cabang', primary: true, render: (b) => `${b.branchName} · ${b.people} orang` },
                { key: 'in', header: 'Masuk (telat + denda)', render: (b) => <span className="tabular-nums">{rupiah(b.disciplineIn)}</span> },
              ]}
            />
            <p className="text-sm">Jumlah perkiraan: <b className="tabular-nums">{rupiah(estimate.total.disciplineIn)}</b></p>
          </Card>
          <Card className="space-y-2">
            <h2 className="font-semibold">Terpesan bonus</h2>
            <DataList
              rows={reserved}
              rowKey={(r) => String(r.id)}
              empty="Tidak ada bonus bersumber Dana Disiplin yang terpesan."
              columns={[
                { key: 'date', header: 'Tanggal', primary: true, render: (r) => `${longDate(r.occurredOn)} · ${r.label}` },
                ...(reserved.some((r) => r.name) ? [{ key: 'name', header: 'Orang', render: (r: (typeof reserved)[number]) => r.name ?? '-' }] : []),
                { key: 'amount', header: 'Nominal', render: (r) => <b className="tabular-nums">{rupiah(r.amount)}</b> },
              ]}
            />
          </Card>
          <Card className="space-y-2"><h2 className="font-semibold">Mutasi</h2><Ledger rows={ledger.discipline} empty="Belum ada mutasi. Mulai dengan Isi saldo awal." /></Card>
        </div>
      )}

      {tab === 'absence' && (
        <div className="space-y-4">
          <Alert tone="info">{props.note}</Alert>
          <div className="grid gap-3 sm:grid-cols-2">
            <Stat label="Saldo berjalan" value={state.absence.balance} hint="Sejak saldo awal" />
            <Stat label="Selisih periode berjalan (perkiraan)" value={estimate.total.absenceIn - estimate.total.absenceOut} hint="Masuk − keluar, belum masuk saldo" />
          </div>
          {can.manage && (
            <div className="flex flex-wrap gap-2">
              {!state.absence.hasEntries && <Link className={buttonClass({ size: 'sm' })} href={href('OPENING', 'ABSENCE')}>Isi saldo awal</Link>}
              <Link className={buttonClass({ size: 'sm', variant: 'secondary' })} href={href('ADJUSTMENT', 'ABSENCE')}>Sesuaikan</Link>
              {state.absence.balance > 0 && <Link className={buttonClass({ size: 'sm', variant: 'secondary' })} href={href('TRANSFER')}>Pindah ke Dana Disiplin</Link>}
            </div>
          )}
          <Card className="space-y-2">
            <div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold">Periode berjalan {period.label}</h2>{estimateNote}</div>
            <DataList
              rows={estimate.branches}
              rowKey={(b) => b.branchName}
              empty="Belum ada hitungan kehadiran di periode ini."
              columns={[
                { key: 'branch', header: 'Cabang', primary: true, render: (b) => `${b.branchName} · ${b.people} orang` },
                { key: 'in', header: 'Masuk (alpha, izin, sakit)', render: (b) => <span className="tabular-nums">{rupiah(b.absenceIn)}</span> },
                { key: 'out', header: 'Keluar (lembur, kompensasi libur)', render: (b) => <span className="tabular-nums">{rupiah(b.absenceOut)}</span> },
                { key: 'diff', header: 'Selisih', render: (b) => <b className="tabular-nums">{signed(b.absenceIn - b.absenceOut)}</b> },
              ]}
            />
          </Card>
          <Card className="space-y-2"><h2 className="font-semibold">Mutasi</h2><Ledger rows={ledger.absence} empty="Belum ada mutasi. Mutasi per periode tercatat saat slip ditutup." /></Card>
        </div>
      )}
    </div>
  );
}
