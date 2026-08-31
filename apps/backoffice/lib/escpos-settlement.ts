/**
 * Penyusun laporan settlement shift sebagai perintah ESC/POS untuk printer termal 80mm.
 *
 * Primitif ESC/POS & helper lebar kolom diambil dari `lib/escpos-common.ts`.
 *
 * Angka-angkanya HARUS sama dengan komponen `components/pos/settlement-print.tsx`
 * (jalur cadangan `window.print()`), jadi rumus omzet/rekonsiliasi di sini disalin
 * apa adanya dari sana.
 *
 * Sengaja bebas dari QZ Tray maupun DOM supaya keluarannya bisa diuji sebagai string biasa.
 */

import Big from 'big.js'
import type { ShiftBreakdownSummary } from '@petshop/shared'
import { formatWIB } from '@petshop/shared'
import {
  ALIGN_CENTER,
  ALIGN_LEFT,
  BOLD_OFF,
  BOLD_ON,
  CODEPAGE_CP437,
  FEED_AND_CUT,
  INIT,
  LF,
  SELECT_FONT_B,
  SIZE_NORMAL,
  SIZE_TALL,
  divider,
  labelAmount,
  money,
  row3,
  toPrintableAscii,
  truncate,
  wrap,
} from '@/lib/escpos-common'

const COLUMNS = 56

export interface SettlementPrintData {
  summary: ShiftBreakdownSummary
  storeName?: string
  storeAddress?: string | null
  storePhone?: string | null
  closedByName: string
  shiftNumber: number
}

function fmtDateTime(date: Date | string | null | undefined): string {
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function fmtDateShort(date: Date | string | null | undefined): string {
  return formatWIB(date, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Rp tanpa Intl currency (spasi tak-putusnya merusak CP437). */
function rp(value: number): string {
  return 'Rp ' + money(value)
}

export function buildSettlementEscpos(data: SettlementPrintData): string {
  const { summary } = data
  const storeName = data.storeName || 'HAMMIELION'
  const { shift, breakdowns } = summary
  const nonCashPayments = summary.nonCashPayments ?? []
  const debtPaymentsReceived = summary.debtPaymentsReceived ?? []
  const debtPaymentCash = summary.totalDebtPaymentCash ?? 0
  const expenses = summary.expenses ?? []
  const expectedCash = summary.totalExpectedCash
  const realCash = summary.totalRealCash ?? 0
  const variance = summary.totalVariance ?? new Big(realCash).minus(expectedCash).toNumber()
  const isShort = variance < 0

  const totals = breakdowns.reduce(
    (acc, b) => ({
      nonCash: acc.nonCash + b.totalSalesQris + b.totalSalesDebit + b.totalSalesCredit,
      debt: acc.debt + b.totalSalesDebt,
      discount: acc.discount + (b.totalDiscount ?? 0),
      expenses: acc.expenses + b.totalExpenses,
      expectedCash: acc.expectedCash + b.expectedCash,
    }),
    { nonCash: 0, debt: 0, discount: 0, expenses: 0, expectedCash: 0 }
  )

  // Omzet = kas penjualan (net kembalian, sebelum dipotong pengeluaran) + non-tunai + hutang.
  const totalOmzet = breakdowns.reduce(
    (sum, b) =>
      new Big(sum)
        .add(b.expectedCash)
        .add(b.totalExpenses)
        .add(b.totalSalesQris)
        .add(b.totalSalesDebit)
        .add(b.totalSalesCredit)
        .add(b.totalSalesDebt)
        .toNumber(),
    0
  )
  const omzetTunai = new Big(totals.expectedCash).add(totals.expenses).toNumber()

  const out: string[] = []
  out.push(INIT, CODEPAGE_CP437, SELECT_FONT_B)

  // Kop
  out.push(ALIGN_CENTER, BOLD_ON, SIZE_TALL)
  out.push(toPrintableAscii(storeName) + LF)
  out.push(SIZE_NORMAL, BOLD_OFF)
  for (const line of wrap(data.storeAddress ?? '')) out.push(line + LF)
  if (data.storePhone) out.push(truncate('Telp: ' + data.storePhone, COLUMNS) + LF)
  out.push(BOLD_ON)
  out.push('LAPORAN SETTLEMENT SHIFT' + LF)
  out.push(BOLD_OFF, ALIGN_LEFT)
  out.push(divider() + LF)

  // Info shift
  out.push(`Shift #${data.shiftNumber}` + LF)
  out.push(truncate('Buka  : ' + fmtDateTime(shift.openedAt), COLUMNS) + LF)
  out.push(truncate('Tutup : ' + fmtDateTime(shift.closedAt), COLUMNS) + LF)
  out.push(truncate('Tutup oleh: ' + data.closedByName, COLUMNS) + LF)
  out.push(divider() + LF)

  // Penjualan (omzet) per metode
  out.push(BOLD_ON + 'PENJUALAN' + BOLD_OFF + LF)
  out.push(labelAmount('Tunai', rp(omzetTunai)) + LF)
  out.push(labelAmount('Non-Tunai', rp(totals.nonCash)) + LF)
  if (totals.discount > 0) out.push(labelAmount('Diskon', '-' + rp(totals.discount)) + LF)
  if (totals.debt > 0) out.push(labelAmount('Hutang', rp(totals.debt)) + LF)
  out.push(BOLD_ON + labelAmount('OMZET', rp(totalOmzet)) + BOLD_OFF + LF)
  out.push(divider() + LF)

  // Rincian per kasir
  out.push(BOLD_ON + 'RINCIAN PER KASIR' + BOLD_OFF + LF)
  for (const b of breakdowns) {
    const nonCash = new Big(b.totalSalesQris).add(b.totalSalesDebit).add(b.totalSalesCredit).toNumber()
    const tunaiNet = new Big(b.expectedCash).add(b.totalExpenses).toNumber()
    out.push(truncate((b.cashierName ?? 'Kasir') + ` (${b.totalTransactions} trx)`, COLUMNS) + LF)
    out.push(labelAmount('Tunai', rp(tunaiNet), 2) + LF)
    out.push(labelAmount('Non-Tunai', rp(nonCash), 2) + LF)
    if ((b.totalDiscount ?? 0) > 0) out.push(labelAmount('Diskon', '-' + rp(b.totalDiscount ?? 0), 2) + LF)
    if (b.totalSalesDebt > 0) out.push(labelAmount('Hutang', rp(b.totalSalesDebt), 2) + LF)
    if (b.totalExpenses > 0) out.push(labelAmount('Pengeluaran', '-' + rp(b.totalExpenses), 2) + LF)
    out.push(labelAmount('Kas Bersih', rp(b.expectedCash), 2) + LF)
  }
  out.push(divider() + LF)

  // Transaksi non-tunai
  if (nonCashPayments.length > 0) {
    out.push(BOLD_ON + 'TRANSAKSI NON-TUNAI' + BOLD_OFF + LF)
    out.push(row3('Tgl', 'Nominal', 'Metode') + LF)
    for (const p of nonCashPayments) {
      out.push(row3(fmtDateShort(p.createdAt), money(p.amount), p.paymentMethodName) + LF)
    }
    out.push(divider() + LF)
  }

  // Pelunasan piutang diterima selama shift
  if (debtPaymentsReceived.length > 0) {
    out.push(BOLD_ON + 'PELUNASAN PIUTANG' + BOLD_OFF + LF)
    for (const p of debtPaymentsReceived) {
      out.push(labelAmount(p.customerName ?? 'Customer', rp(p.amount)) + LF)
      out.push(
        truncate(
          '  ' + fmtDateShort(p.createdAt) + ' ' + p.paymentMethodName + (p.isCash ? '' : ' (non-tunai)'),
          COLUMNS
        ) + LF
      )
      out.push(
        truncate(
          '  ' + (p.trxNumber ?? 'Hutang manual') + (p.receivedByName ? ` - ${p.receivedByName}` : ''),
          COLUMNS
        ) + LF
      )
    }
    out.push(BOLD_ON + labelAmount('Diterima Tunai', rp(debtPaymentCash)) + BOLD_OFF + LF)
    out.push('Tidak dihitung sebagai omzet shift ini.' + LF)
    out.push(divider() + LF)
  }

  // Rincian pengeluaran
  if (expenses.length > 0) {
    out.push(BOLD_ON + 'RINCIAN PENGELUARAN' + BOLD_OFF + LF)
    for (const e of expenses) {
      out.push(labelAmount(e.categoryName ?? e.categoryCustom ?? 'Lainnya', '-' + rp(e.amount)) + LF)
      out.push(
        truncate('  ' + fmtDateShort(e.createdAt) + (e.cashierName ? ` - ${e.cashierName}` : ''), COLUMNS) + LF
      )
      for (const line of wrap(e.note ?? '', COLUMNS - 2)) out.push('  ' + line + LF)
    }
    out.push(BOLD_ON + labelAmount('Total Pengeluaran', '-' + rp(totals.expenses)) + BOLD_OFF + LF)
    out.push(divider() + LF)
  }

  // Rekonsiliasi kas
  out.push(BOLD_ON + 'REKONSILIASI KAS' + BOLD_OFF + LF)
  if (totals.expenses > 0 || debtPaymentCash > 0) {
    out.push(labelAmount('Kas Penjualan Tunai', rp(omzetTunai)) + LF)
    if (totals.expenses > 0) out.push(labelAmount('Pengeluaran', '-' + rp(totals.expenses)) + LF)
    if (debtPaymentCash > 0) out.push(labelAmount('Pelunasan Piutang Tunai', '+' + rp(debtPaymentCash)) + LF)
  }
  out.push(labelAmount('Kas Harus Ada', rp(expectedCash)) + LF)
  out.push(labelAmount('Kas Disetor', rp(realCash)) + LF)
  const varianceText =
    (variance >= 0 ? '+' : '') + rp(variance) + (isShort ? ' (Kurang)' : variance > 0 ? ' (Lebih)' : '')
  out.push(BOLD_ON + labelAmount('SELISIH', varianceText) + BOLD_OFF + LF)
  out.push(labelAmount('Modal awal (dikembalikan)', rp(shift.openingCash)) + LF)

  // Catatan
  if (shift.settlementNotes) {
    out.push(divider() + LF)
    out.push(BOLD_ON + 'Catatan:' + BOLD_OFF + LF)
    for (const line of wrap(shift.settlementNotes)) out.push(line + LF)
  }

  out.push(FEED_AND_CUT)
  return out.join('')
}
