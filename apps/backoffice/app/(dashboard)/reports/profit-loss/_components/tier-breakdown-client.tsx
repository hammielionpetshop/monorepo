'use client'

import Big from 'big.js'
import { useState } from 'react'
import { NewBadge } from '@/components/ui/new-badge'
import type { PLTierScope } from '@/lib/services/report-service'

function formatRupiah(value: string): string {
  try {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(new Big(value).toNumber())
  } catch {
    return 'Rp 0'
  }
}

function formatMargin(revenue: string, grossProfit: string): string {
  try {
    const rev = new Big(revenue)
    if (rev.eq(0)) return '—'
    return `${new Intl.NumberFormat('id-ID', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
      new Big(grossProfit).div(rev).times(100).toNumber(),
    )}%`
  } catch {
    return '—'
  }
}

export default function TierBreakdownClient({ scopes }: { scopes: PLTierScope[] }) {
  // Cakupan dikunci berdasarkan branchId (null = Semua Cabang) supaya pilihan tetap benar walau
  // urutan cakupan berubah antar periode.
  const [selectedKey, setSelectedKey] = useState<string>(() => String(scopes[0]?.branchId ?? 'all'))

  if (scopes.length === 0) return null

  const scope = scopes.find((s) => String(s.branchId ?? 'all') === selectedKey) ?? scopes[0]!
  const gap = new Big(scope.plRevenue).minus(scope.totalRevenue)
  const hasGap = !gap.eq(0)

  return (
    <div className="mt-6 bg-card rounded-lg border border-border overflow-hidden shadow-xs">
      <div className="px-6 py-4 border-b border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold text-card-foreground">
            Penjualan &amp; Laba Kotor per Kelas Harga <NewBadge feature="fitur/laba-rugi-per-tier" />
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Omzet &amp; HPP dipecah per kelas harga (Retail / Reseller / Grosir / Member) yang dipakai nota,
            sudah dikurangi retur. Dihitung dari nilai baris nota — sama dengan Laporan Penjualan per Produk.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs font-semibold text-card-foreground">
          Cabang
          <select
            value={selectedKey}
            onChange={(e) => setSelectedKey(e.target.value)}
            className="rounded-md border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          >
            {scopes.map((s) => (
              <option key={String(s.branchId ?? 'all')} value={String(s.branchId ?? 'all')}>
                {s.branchName}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 text-muted-foreground border-b border-border">
              <th className="text-left px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Kelas Harga</th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Omzet</th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">HPP</th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Laba Kotor</th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Margin</th>
              <th className="text-right px-6 py-3 font-bold uppercase tracking-widest text-[10px]">Jml Transaksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {scope.tiers.map((tier) => (
              <tr key={tier.tier} className="hover:bg-muted/20 transition-colors">
                <td className="px-6 py-3 font-semibold text-card-foreground">{tier.tierLabel}</td>
                <td className="px-6 py-3 text-right font-medium text-card-foreground">
                  {formatRupiah(tier.revenue)}
                  {Number(tier.returnRevenue) > 0 && (
                    <div className="text-[11px] font-normal text-destructive">retur −{formatRupiah(tier.returnRevenue)}</div>
                  )}
                </td>
                <td className="px-6 py-3 text-right text-muted-foreground">{formatRupiah(tier.cogs)}</td>
                <td className="px-6 py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(tier.grossProfit)}
                </td>
                <td className="px-6 py-3 text-right font-medium text-card-foreground">
                  {formatMargin(tier.revenue, tier.grossProfit)}
                </td>
                <td className="px-6 py-3 text-right text-card-foreground">{tier.transactionCount}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-border bg-muted/40">
              <td className="px-6 py-3 font-bold text-card-foreground">TOTAL</td>
              <td className="px-6 py-3 text-right font-bold text-card-foreground">{formatRupiah(scope.totalRevenue)}</td>
              <td className="px-6 py-3 text-right font-bold text-card-foreground">{formatRupiah(scope.totalCogs)}</td>
              <td className="px-6 py-3 text-right font-bold text-primary">{formatRupiah(scope.totalGrossProfit)}</td>
              <td className="px-6 py-3 text-right font-bold text-card-foreground">
                {formatMargin(scope.totalRevenue, scope.totalGrossProfit)}
              </td>
              <td className="px-6 py-3"></td>
            </tr>
          </tfoot>
        </table>
      </div>
      {hasGap && (
        <p className="px-6 py-3 text-xs text-muted-foreground border-t border-border">
          Total omzet per kelas harga ({formatRupiah(scope.totalRevenue)}) berbeda {formatRupiah(gap.abs().toString())}{' '}
          dari Pendapatan Laba Rugi {scope.branchId == null ? 'seluruh cabang' : scope.branchName} ({formatRupiah(scope.plRevenue)}).
          Selisih ini berasal dari diskon atau pajak tingkat nota yang tidak melekat ke satu kelas harga, jadi sengaja
          tidak dibagi ke kelas manapun.
        </p>
      )}
    </div>
  )
}
