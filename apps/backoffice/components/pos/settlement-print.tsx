'use client'

import Big from 'big.js'
import type { ShiftBreakdownSummary } from '@petshop/shared'

interface SettlementPrintProps {
  summary: ShiftBreakdownSummary
  branchName: string
  closedByName: string
  shiftNumber: number
}

function formatRupiahSimple(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-'
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d)
}

export default function SettlementPrint({
  summary,
  branchName,
  closedByName,
  shiftNumber,
}: SettlementPrintProps) {
  const { shift, breakdowns } = summary
  const nonCashPayments = summary.nonCashPayments ?? []
  const expectedCash = summary.totalExpectedCash
  const realCash = summary.totalRealCash ?? 0
  const variance = summary.totalVariance ?? new Big(realCash).minus(expectedCash).toNumber()
  const isShort = variance < 0

  const rowStyle = { display: 'flex', justifyContent: 'space-between' } as const

  // Total lintas kasir (ditampilkan bila lebih dari satu kasir)
  const totals = breakdowns.reduce(
    (acc, b) => ({
      cash: acc.cash + b.totalSalesCash,
      nonCash:
        acc.nonCash + b.totalSalesQris + b.totalSalesDebit + b.totalSalesCredit,
      debt: acc.debt + b.totalSalesDebt,
      expenses: acc.expenses + b.totalExpenses,
      expectedCash: acc.expectedCash + b.expectedCash,
    }),
    { cash: 0, nonCash: 0, debt: 0, expenses: 0, expectedCash: 0 }
  )
  const showTotals = breakdowns.length > 1
  const totalNonCash = nonCashPayments.reduce((sum, p) => sum + p.amount, 0)

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: 80mm auto;
              margin: 3mm;
            }
            @media print {
              body * {
                visibility: hidden !important;
              }
              .print-container-settlement,
              .print-container-settlement * {
                visibility: visible !important;
              }
              .print-container-settlement {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: white !important;
                color: black !important;
                padding: 0 !important;
              }
            }
          `,
        }}
      />
      <div
        className="hidden print:block fixed top-0 left-0 w-full z-[9999] bg-white text-black print-container-settlement"
        style={{
          fontFamily: '"Arial Narrow", "Liberation Sans Narrow", Arial, Helvetica, sans-serif',
          fontSize: '17px',
          lineHeight: 1.25,
          letterSpacing: '-0.4px',
          padding: '0 4mm',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <p style={{ fontWeight: 'bold', fontSize: '21px' }}>HAMMIELION</p>
          <p>{branchName}</p>
          <p style={{ borderTop: '1px dashed #000', marginTop: '4px', paddingTop: '4px', fontWeight: 'bold' }}>
            LAPORAN SETTLEMENT SHIFT
          </p>
        </div>

        {/* Info */}
        <div style={{ marginBottom: '8px' }}>
          <p>Shift #{shiftNumber}</p>
          <p>Buka: {formatDate(shift.openedAt)}</p>
          <p>Tutup: {formatDate(shift.closedAt)}</p>
          <p>Ditutup oleh: {closedByName}</p>
        </div>

        {/* Per kasir */}
        <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', marginBottom: '8px' }}>
          <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>RINCIAN PER KASIR</p>
          {breakdowns.map((b) => {
            const nonCash = new Big(b.totalSalesQris)
              .add(b.totalSalesDebit)
              .add(b.totalSalesCredit)
              .toNumber()
            return (
              <div key={b.cashierId} style={{ marginBottom: '6px' }}>
                <p style={{ fontWeight: 'bold' }}>
                  {b.cashierName ?? 'Kasir'} ({b.totalTransactions} trx)
                </p>
                <div style={rowStyle}>
                  <span>Tunai</span>
                  <span>{formatRupiahSimple(b.totalSalesCash)}</span>
                </div>
                <div style={rowStyle}>
                  <span>Non-Tunai</span>
                  <span>{formatRupiahSimple(nonCash)}</span>
                </div>
                {b.totalSalesDebt > 0 && (
                  <div style={rowStyle}>
                    <span>Hutang</span>
                    <span>{formatRupiahSimple(b.totalSalesDebt)}</span>
                  </div>
                )}
                <div style={rowStyle}>
                  <span>Pengeluaran</span>
                  <span>-{formatRupiahSimple(b.totalExpenses)}</span>
                </div>
                <div style={{ ...rowStyle, fontWeight: 'bold' }}>
                  <span>Kas Bersih</span>
                  <span>{formatRupiahSimple(b.expectedCash)}</span>
                </div>
              </div>
            )
          })}

          {showTotals && (
            <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '2px' }}>
              <p style={{ fontWeight: 'bold' }}>TOTAL SEMUA KASIR</p>
              <div style={rowStyle}>
                <span>Tunai</span>
                <span>{formatRupiahSimple(totals.cash)}</span>
              </div>
              <div style={rowStyle}>
                <span>Non-Tunai</span>
                <span>{formatRupiahSimple(totals.nonCash)}</span>
              </div>
              {totals.debt > 0 && (
                <div style={rowStyle}>
                  <span>Hutang</span>
                  <span>{formatRupiahSimple(totals.debt)}</span>
                </div>
              )}
              <div style={rowStyle}>
                <span>Pengeluaran</span>
                <span>-{formatRupiahSimple(totals.expenses)}</span>
              </div>
              <div style={{ ...rowStyle, fontWeight: 'bold' }}>
                <span>Kas Bersih</span>
                <span>{formatRupiahSimple(totals.expectedCash)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Daftar transaksi non-tunai */}
        {nonCashPayments.length > 0 && (
          <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', marginBottom: '8px' }}>
            <p style={{ fontWeight: 'bold', marginBottom: '4px' }}>TRANSAKSI NON-TUNAI</p>
            <div style={{ ...rowStyle, fontSize: '14px', fontWeight: 'bold' }}>
              <span style={{ flex: '0 0 34%' }}>Tgl</span>
              <span style={{ flex: '0 0 30%' }}>Nominal</span>
              <span style={{ flex: '0 0 36%', textAlign: 'right' }}>Metode</span>
            </div>
            {nonCashPayments.map((p, idx) => (
              <div key={idx} style={{ ...rowStyle, fontSize: '15px' }}>
                <span style={{ flex: '0 0 34%' }}>{formatDateShort(p.createdAt)}</span>
                <span style={{ flex: '0 0 30%' }}>{formatRupiahSimple(p.amount)}</span>
                <span style={{ flex: '0 0 36%', textAlign: 'right' }}>{p.paymentMethodName}</span>
              </div>
            ))}
            <div style={{ ...rowStyle, fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '2px' }}>
              <span>Total Non-Tunai</span>
              <span>{formatRupiahSimple(totalNonCash)}</span>
            </div>
          </div>
        )}

        {/* Rekonsiliasi */}
        <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', marginBottom: '8px' }}>
          <div style={rowStyle}>
            <span>Modal Awal (terpisah)</span>
            <span>{formatRupiahSimple(shift.openingCash)}</span>
          </div>
          <div style={rowStyle}>
            <span>Kas Penjualan Harus Ada</span>
            <span>{formatRupiahSimple(expectedCash)}</span>
          </div>
          <div style={{ ...rowStyle, fontWeight: 'bold' }}>
            <span>Kas Disetor</span>
            <span>{formatRupiahSimple(realCash)}</span>
          </div>
          <div style={{ ...rowStyle, fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '4px', marginTop: '4px' }}>
            <span>SELISIH</span>
            <span>
              {variance >= 0 ? '+' : ''}
              {formatRupiahSimple(variance)}
              {isShort ? ' (Kurang)' : variance > 0 ? ' (Lebih)' : ''}
            </span>
          </div>
        </div>

        {/* Catatan */}
        {shift.settlementNotes && (
          <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', marginBottom: '8px' }}>
            <p style={{ fontWeight: 'bold' }}>Catatan:</p>
            <p>{shift.settlementNotes}</p>
          </div>
        )}
      </div>
    </>
  )
}
