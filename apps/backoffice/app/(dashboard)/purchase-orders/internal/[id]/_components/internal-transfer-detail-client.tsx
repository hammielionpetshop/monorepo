'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { InternalTransferDetail } from './types'

const PRINT_STYLES = `
@media print {
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body > * { display: none !important; }
  #surat-jalan-print { display: block !important; }
  @page {
    size: A4;
    margin: 12mm 14mm;
  }
}
#surat-jalan-print {
  display: none;
  font-family: 'Courier New', Courier, monospace;
  font-size: 11pt;
  color: #000;
  line-height: 1.4;
}
#surat-jalan-print .sj-header {
  text-align: center;
  border-bottom: 2px solid #000;
  padding-bottom: 6pt;
  margin-bottom: 8pt;
}
#surat-jalan-print .sj-title {
  font-size: 16pt;
  font-weight: bold;
  letter-spacing: 2px;
}
#surat-jalan-print .sj-subtitle {
  font-size: 10pt;
}
#surat-jalan-print .sj-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8pt;
  font-size: 10pt;
}
#surat-jalan-print .sj-section {
  border: 1px solid #000;
  padding: 6pt 8pt;
  margin-bottom: 8pt;
  display: flex;
  gap: 24pt;
}
#surat-jalan-print .sj-field { flex: 1; }
#surat-jalan-print .sj-label { font-size: 9pt; text-transform: uppercase; }
#surat-jalan-print .sj-value { font-weight: bold; font-size: 11pt; }
#surat-jalan-print .sj-arrow {
  display: flex;
  align-items: center;
  font-size: 18pt;
  padding: 0 4pt;
}
#surat-jalan-print table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 8pt;
  font-size: 10pt;
}
#surat-jalan-print table th {
  border: 1px solid #000;
  padding: 4pt 6pt;
  text-align: left;
  background: #f0f0f0;
  font-size: 9pt;
  text-transform: uppercase;
}
#surat-jalan-print table td {
  border: 1px solid #000;
  padding: 4pt 6pt;
}
#surat-jalan-print table td.right { text-align: right; }
#surat-jalan-print .sj-notes {
  border: 1px solid #000;
  padding: 6pt 8pt;
  margin-bottom: 12pt;
  font-size: 10pt;
  min-height: 28pt;
}
#surat-jalan-print .sj-signatures {
  display: flex;
  gap: 8pt;
  margin-top: 12pt;
}
#surat-jalan-print .sj-sig {
  flex: 1;
  border: 1px solid #000;
  padding: 6pt 8pt;
  text-align: center;
}
#surat-jalan-print .sj-sig-title { font-size: 9pt; font-weight: bold; text-transform: uppercase; }
#surat-jalan-print .sj-sig-space { height: 44pt; }
#surat-jalan-print .sj-sig-name { border-top: 1px solid #000; padding-top: 4pt; font-size: 9pt; }
#surat-jalan-print .sj-footer {
  margin-top: 8pt;
  font-size: 8pt;
  text-align: right;
  color: #555;
}
`

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  PENDING_APPROVAL: { label: 'Menunggu Approval', color: 'bg-yellow-100 text-yellow-800' },
  APPROVED: { label: 'Disetujui', color: 'bg-blue-100 text-blue-800' },
  PREPARING: { label: 'Sedang Disiapkan', color: 'bg-indigo-100 text-indigo-800' },
  IN_TRANSIT: { label: 'Dalam Pengiriman', color: 'bg-orange-100 text-orange-800' },
  PARTIALLY_RECEIVED: { label: 'Diterima Sebagian', color: 'bg-amber-100 text-amber-800' },
  FULLY_RECEIVED: { label: 'Diterima Penuh', color: 'bg-green-100 text-green-800' },
  CANCELLED: { label: 'Dibatalkan', color: 'bg-red-100 text-red-700' },
}

interface Props {
  transfer: InternalTransferDetail
  role: string
}

export function InternalTransferDetailClient({ transfer, role }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [showShipForm, setShowShipForm] = useState(false)
  const [shipQty, setShipQty] = useState<Record<number, number>>(
    () => Object.fromEntries(transfer.items.map((i) => [i.id, i.qtyRequested]))
  )
  const [stockMap, setStockMap] = useState<Record<number, number>>({})
  const [stockLoading, setStockLoading] = useState(false)

  async function openShipForm() {
    setShowShipForm(true)
    setStockLoading(true)
    try {
      const res = await fetch(`/api/bo/internal-transfers/${transfer.id}/stock-check`)
      if (res.ok) {
        const data: { itemId: number; currentQty: number }[] = await res.json()
        setStockMap(Object.fromEntries(data.map((d) => [d.itemId, d.currentQty])))
      }
    } finally {
      setStockLoading(false)
    }
  }

  const statusInfo = STATUS_LABELS[transfer.status] ?? {
    label: transfer.status,
    color: 'bg-gray-100 text-gray-600',
  }

  const isManagerRole = ['OWNER', 'GM', 'MANAGER'].includes(role)

  async function callAction(action: string, label: string) {
    if (!confirm(`Konfirmasi: ${label}?`)) return
    setLoading(action)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/internal-transfers/${transfer.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
      setSuccessMsg('Status berhasil diperbarui')
      setTimeout(() => setSuccessMsg(null), 3000)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message)
      setTimeout(() => setErrorMsg(null), 5000)
    } finally {
      setLoading(null)
    }
  }

  async function handleShipSubmit() {
    setLoading('ship')
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/bo/internal-transfers/${transfer.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ship',
          items: transfer.items.map((i) => ({ itemId: i.id, qtyShipped: shipQty[i.id] ?? 0 })),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan')
      setSuccessMsg('Barang berhasil ditandai dikirim')
      setShowShipForm(false)
      setTimeout(() => setSuccessMsg(null), 3000)
      router.refresh()
    } catch (err: any) {
      setErrorMsg(err.message)
      setTimeout(() => setErrorMsg(null), 5000)
    } finally {
      setLoading(null)
    }
  }

  const handlePrint = () => window.print()

  const showPrint = ['IN_TRANSIT', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'].includes(transfer.status)

  const printDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const transferDate = new Date(transfer.createdAt).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="space-y-6">
      {/* Print styles injected into head */}
      <style dangerouslySetInnerHTML={{ __html: PRINT_STYLES }} />

      {/* Surat Jalan — hanya muncul saat print */}
      <div id="surat-jalan-print">
        <div className="sj-header">
          <div className="sj-title">SURAT JALAN</div>
          <div className="sj-subtitle">Transfer Internal Antar Cabang</div>
        </div>

        <div className="sj-meta">
          <div>
            <span>No. Dokumen: </span>
            <strong>{transfer.ibtNumber}</strong>
          </div>
          <div>
            <span>Tanggal: </span>
            <strong>{transferDate}</strong>
          </div>
        </div>

        <div className="sj-section">
          <div className="sj-field">
            <div className="sj-label">Cabang Pengirim</div>
            <div className="sj-value">{transfer.sourceBranchName ?? '-'}</div>
          </div>
          <div className="sj-arrow">→</div>
          <div className="sj-field">
            <div className="sj-label">Cabang Penerima</div>
            <div className="sj-value">{transfer.destinationBranchName ?? '-'}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style={{ width: '28pt' }}>No</th>
              <th>Nama Produk</th>
              <th style={{ width: '60pt' }}>SKU</th>
              <th className="right" style={{ width: '36pt' }}>Qty</th>
              <th style={{ width: '36pt' }}>Satuan</th>
              <th className="right" style={{ width: '36pt' }}>Terima</th>
            </tr>
          </thead>
          <tbody>
            {transfer.items.map((item, idx) => (
              <tr key={item.id}>
                <td>{idx + 1}</td>
                <td>{item.productName ?? '-'}</td>
                <td style={{ fontFamily: 'monospace' }}>{item.productSku ?? '-'}</td>
                <td className="right">{item.qtyShipped > 0 ? item.qtyShipped : item.qtyRequested}</td>
                <td>{item.uomCode ?? '-'}</td>
                <td className="right"></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="sj-notes">
          <div style={{ fontSize: '9pt', fontWeight: 'bold', marginBottom: '4pt' }}>CATATAN:</div>
          <div>{transfer.notes || ''}</div>
        </div>

        <div className="sj-signatures">
          <div className="sj-sig">
            <div className="sj-sig-title">Pengirim</div>
            <div className="sj-sig-space" />
            <div className="sj-sig-name">( _________________________ )</div>
          </div>
          <div className="sj-sig">
            <div className="sj-sig-title">Kurir / Pengantar</div>
            <div className="sj-sig-space" />
            <div className="sj-sig-name">( _________________________ )</div>
          </div>
          <div className="sj-sig">
            <div className="sj-sig-title">Penerima</div>
            <div className="sj-sig-space" />
            <div className="sj-sig-name">( _________________________ )</div>
          </div>
        </div>

        <div className="sj-footer">
          Dicetak pada: {printDate} &nbsp;|&nbsp; Pemohon: {transfer.requestedByName ?? '-'}
        </div>
      </div>

      <a
        href="/purchase-orders/internal"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Kembali ke daftar transfer internal
      </a>

      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-md text-sm"
        >
          {successMsg}
        </div>
      )}

      {errorMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm"
        >
          {errorMsg}
        </div>
      )}

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold font-mono">{transfer.ibtNumber}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo.color}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {new Date(transfer.createdAt).toLocaleDateString('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          {showPrint && (
            <button
              onClick={handlePrint}
              className="px-4 py-2 border border-border text-sm font-medium rounded-md hover:bg-accent transition-colors print:hidden"
            >
              Print Surat Jalan
            </button>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-3 text-sm">
            <span className="font-medium text-foreground">
              {transfer.sourceBranchName ?? '-'}
            </span>
            <span className="text-muted-foreground">→</span>
            <span className="font-medium text-foreground">
              {transfer.destinationBranchName ?? '-'}
            </span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4 pt-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground">Pemohon</p>
            <p className="text-sm font-medium mt-0.5">{transfer.requestedByName ?? '-'}</p>
          </div>
          {transfer.approvedByName && (
            <div>
              <p className="text-xs text-muted-foreground">Disetujui Oleh</p>
              <p className="text-sm font-medium mt-0.5">{transfer.approvedByName}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Est. Nilai Transfer</p>
            <p className="text-sm font-medium mt-0.5">
              Rp {Number(transfer.totalTransferValue).toLocaleString('id-ID')}
            </p>
          </div>
        </div>

        {transfer.notes && (
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground">Catatan</p>
            <p className="text-sm mt-0.5">{transfer.notes}</p>
          </div>
        )}
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-medium text-foreground">
            Item Transfer ({transfer.items.length} produk)
          </h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Produk</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">SKU</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty Request</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty Kirim</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Qty Terima</th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">Satuan</th>
              <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. HPP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transfer.items.map((item) => (
              <tr key={item.id} className="hover:bg-muted/20">
                <td className="px-4 py-3 font-medium text-foreground">
                  {item.productName ?? '-'}
                </td>
                <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                  {item.productSku ?? '-'}
                </td>
                <td className="px-4 py-3 text-right">{item.qtyRequested}</td>
                <td className="px-4 py-3 text-right">
                  {item.qtyShipped > 0 ? (
                    <span
                      className={
                        item.qtyShipped < item.qtyRequested ? 'text-orange-600' : ''
                      }
                    >
                      {item.qtyShipped}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.qtyReceived > 0 ? (
                    <span className={item.qtyReceived < item.qtyShipped ? 'text-orange-600' : 'text-green-600'}>
                      {item.qtyReceived}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {item.uomCode ?? '-'}
                </td>
                <td className="px-4 py-3 text-right">
                  Rp {Number(item.costPriceAtTransfer).toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Actions */}
      {!['FULLY_RECEIVED', 'CANCELLED'].includes(transfer.status) && (
        <div className="bg-card border border-border rounded-lg p-6 print:hidden">
          <h2 className="font-medium text-foreground mb-4">Aksi</h2>

          <div className="flex flex-wrap gap-3">
            {transfer.status === 'DRAFT' && isManagerRole && (
              <>
                <button
                  onClick={() => callAction('approve', 'Ajukan dan setujui transfer ini')}
                  disabled={loading !== null}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading === 'approve' ? 'Memproses...' : 'Ajukan & Setujui'}
                </button>
                <button
                  onClick={() => callAction('cancel', 'Batalkan transfer ini')}
                  disabled={loading !== null}
                  className="px-4 py-2 border border-destructive text-destructive text-sm font-medium rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  {loading === 'cancel' ? 'Memproses...' : 'Batalkan'}
                </button>
              </>
            )}

            {transfer.status === 'PENDING_APPROVAL' && isManagerRole && (
              <>
                <button
                  onClick={() => callAction('approve', 'Setujui transfer ini')}
                  disabled={loading !== null}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {loading === 'approve' ? 'Memproses...' : 'Setujui'}
                </button>
                <button
                  onClick={() => callAction('cancel', 'Batalkan transfer ini')}
                  disabled={loading !== null}
                  className="px-4 py-2 border border-destructive text-destructive text-sm font-medium rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                >
                  {loading === 'cancel' ? 'Memproses...' : 'Batalkan'}
                </button>
              </>
            )}

            {transfer.status === 'APPROVED' && (
              <>
                <button
                  onClick={() => callAction('prepare', 'Mulai persiapan pengiriman')}
                  disabled={loading !== null}
                  className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'prepare' ? 'Memproses...' : 'Mulai Persiapan'}
                </button>
                {isManagerRole && (
                  <button
                    onClick={() => callAction('cancel', 'Batalkan transfer ini')}
                    disabled={loading !== null}
                    className="px-4 py-2 border border-destructive text-destructive text-sm font-medium rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    {loading === 'cancel' ? 'Memproses...' : 'Batalkan'}
                  </button>
                )}
              </>
            )}

            {transfer.status === 'PREPARING' && !showShipForm && (
              <button
                onClick={openShipForm}
                disabled={loading !== null}
                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
              >
                Konfirmasi Pengiriman
              </button>
            )}

            {transfer.status === 'IN_TRANSIT' && (
              <>
                <button
                  onClick={() => callAction('receive', 'Konfirmasi penerimaan barang — stok cabang tujuan akan ditambah')}
                  disabled={loading !== null}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  {loading === 'receive' ? 'Memproses...' : 'Konfirmasi Diterima'}
                </button>
                {isManagerRole && (
                  <button
                    onClick={() => callAction('cancel', 'Batalkan transfer — stok cabang asal akan dikembalikan')}
                    disabled={loading !== null}
                    className="px-4 py-2 border border-destructive text-destructive text-sm font-medium rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-colors"
                  >
                    {loading === 'cancel' ? 'Memproses...' : 'Batalkan & Kembalikan Stok'}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {transfer.status === 'PREPARING' && showShipForm && (
        <div className="bg-card border border-orange-200 rounded-lg p-6 print:hidden">
          <h2 className="font-medium text-foreground mb-1">Konfirmasi Qty Pengiriman</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Isi qty aktual yang akan dikirim berdasarkan stok fisik. Qty bisa dikurangi jika stok tidak mencukupi.
          </p>
          {stockLoading && (
            <p className="text-sm text-muted-foreground mb-3">Memuat data stok...</p>
          )}
          <table className="w-full text-sm mb-4">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Produk</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Diminta</th>
                <th className="text-right py-2 pr-4 font-medium text-muted-foreground">Stok Sistem</th>
                <th className="text-right py-2 font-medium text-muted-foreground w-36">Qty Kirim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfer.items.map((item) => {
                const currentStock = stockMap[item.id]
                const qtyKirim = shipQty[item.id] ?? 0
                const stockKurang = currentStock !== undefined && qtyKirim > currentStock
                const kurangDariPermintaan = qtyKirim < item.qtyRequested

                return (
                  <tr key={item.id}>
                    <td className="py-2 pr-4">
                      <div className="font-medium">{item.productName ?? '-'}</div>
                      <div className="text-xs text-muted-foreground font-mono">{item.productSku ?? '-'}</div>
                    </td>
                    <td className="py-2 pr-4 text-right text-muted-foreground">
                      {item.qtyRequested} {item.uomCode}
                    </td>
                    <td className="py-2 pr-4 text-right">
                      {stockLoading ? (
                        <span className="text-muted-foreground">...</span>
                      ) : currentStock !== undefined ? (
                        <span className={currentStock < item.qtyRequested ? 'text-red-600 font-medium' : 'text-foreground'}>
                          {currentStock} {item.uomCode}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-2">
                      <div className="flex items-center justify-end gap-1">
                        <input
                          type="number"
                          min={0}
                          max={item.qtyRequested}
                          value={qtyKirim}
                          onChange={(e) =>
                            setShipQty((prev) => ({
                              ...prev,
                              [item.id]: Math.max(0, parseInt(e.target.value) || 0),
                            }))
                          }
                          className={`w-20 text-right border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 ${
                            stockKurang
                              ? 'border-red-400 focus:ring-red-400'
                              : 'border-border focus:ring-orange-400'
                          }`}
                        />
                        <span className="text-muted-foreground text-xs">{item.uomCode}</span>
                      </div>
                      {stockKurang && (
                        <div className="text-xs text-red-600 mt-0.5 text-right">
                          ⚠ melebihi stok sistem ({currentStock})
                        </div>
                      )}
                      {!stockKurang && kurangDariPermintaan && (
                        <div className="text-xs text-orange-500 mt-0.5 text-right">
                          kurang {item.qtyRequested - qtyKirim} dari permintaan
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex gap-3">
            <button
              onClick={handleShipSubmit}
              disabled={loading !== null}
              className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-md hover:bg-orange-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'ship' ? 'Memproses...' : 'Tandai Sudah Dikirim'}
            </button>
            <button
              onClick={() => setShowShipForm(false)}
              disabled={loading !== null}
              className="px-4 py-2 border border-border text-sm font-medium rounded-md hover:bg-accent disabled:opacity-50 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {transfer.status === 'FULLY_RECEIVED' && (
        <div className="bg-card border border-border rounded-lg p-6 print:hidden">
          <p className="text-sm text-green-600 font-medium">
            Transfer selesai. Stok cabang tujuan sudah diperbarui.
          </p>
        </div>
      )}

      {transfer.status === 'CANCELLED' && (
        <div className="bg-card border border-border rounded-lg p-6 print:hidden">
          <p className="text-sm text-muted-foreground">Transfer ini telah dibatalkan.</p>
        </div>
      )}
    </div>
  )
}
