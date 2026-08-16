'use client'

import { useState, useRef } from 'react'
import { X, Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { Branch } from './types'

interface PreviewRow {
  rowNumber: number
  sku: string | null
  namaProduk: string | null
  satuan: string | null
  productId: number | null
  productName: string | null
  uomCode: string | null
  status: 'insert' | 'update' | 'unchanged' | 'rejected'
  reason?: string
  fields: {
    modal?: { old: number | null; new: number; action: 'insert' | 'update' | 'unchanged' }
    harga_retail?: { old: number | null; new: number; action: 'insert' | 'update' | 'unchanged' }
    harga_reseller?: { old: number | null; new: number; action: 'insert' | 'update' | 'unchanged' }
    harga_grosir?: { old: number | null; new: number; action: 'insert' | 'update' | 'unchanged' }
    harga_member?: { old: number | null; new: number; action: 'insert' | 'update' | 'unchanged' }
  }
}

interface Summary {
  totalRows: number
  insertCount: number
  updateCount: number
  unchangedCount: number
  rejectedCount: number
  priceChangeCount: number
  costChangeCount: number
}

interface PreviewResponse {
  sessionId: string | null
  branchId: number
  summary: Summary
  rows: PreviewRow[]
  fileName: string
  expiresInSec: number
}

interface Props {
  branches: Branch[]
  defaultBranchId: number
  onClose: () => void
  onSuccess: (updated: number) => void
}

type Step = 'upload' | 'preview' | 'applying'

const STATUS_LABEL: Record<PreviewRow['status'], string> = {
  insert: 'Baru',
  update: 'Ubah',
  unchanged: 'Sama',
  rejected: 'Tolak',
}

const STATUS_CLASS: Record<PreviewRow['status'], string> = {
  insert: 'bg-green-100 text-green-800 border-green-200',
  update: 'bg-blue-100 text-blue-800 border-blue-200',
  unchanged: 'bg-muted text-muted-foreground border-border',
  rejected: 'bg-destructive/10 text-destructive border-destructive/30',
}

export default function ImportDialog({ branches, defaultBranchId, onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>('upload')
  const [branchId, setBranchId] = useState<number>(defaultBranchId)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<PreviewResponse | null>(null)
  const [isBusy, setIsBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showOnlyChanged, setShowOnlyChanged] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const targetBranchName = branches.find(b => b.id === branchId)?.name ?? ''

  async function handleUpload() {
    if (!file) {
      setErrorMsg('Pilih file dulu')
      return
    }
    setIsBusy(true)
    setErrorMsg(null)
    try {
      const form = new FormData()
      form.append('branchId', String(branchId))
      form.append('file', file)
      const res = await fetch('/api/bo/master-data/prices/import/preview', {
        method: 'POST',
        body: form,
      })
      const json = await res.json() as PreviewResponse & { error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Gagal memproses file')
      setPreview(json)
      setStep('preview')
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsBusy(false)
    }
  }

  async function handleApply() {
    if (!preview || !preview.sessionId) return
    setStep('applying')
    setIsBusy(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/bo/master-data/prices/import/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: preview.sessionId }),
      })
      const json = await res.json() as { updated?: number; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Gagal menerapkan perubahan')
      onSuccess(json.updated ?? 0)
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
      setStep('preview')
    } finally {
      setIsBusy(false)
    }
  }

  const visibleRows = preview
    ? (showOnlyChanged
        ? preview.rows.filter(r => r.status !== 'unchanged')
        : preview.rows)
    : []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">
            {step === 'upload' && 'Impor Harga dari File'}
            {step === 'preview' && `Pratinjau Perubahan — ${preview?.fileName ?? ''}`}
            {step === 'applying' && 'Menerapkan Perubahan...'}
          </h2>
          <button
            onClick={onClose}
            disabled={isBusy}
            className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 'upload' && (
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Cabang tujuan
                </label>
                <select
                  value={branchId}
                  onChange={e => setBranchId(Number(e.target.value))}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
                >
                  {branches.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  File (.csv atau .xlsx)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                  className="w-full text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground file:mr-3 file:py-1 file:px-3 file:border-0 file:rounded file:text-xs file:font-medium file:bg-muted file:text-foreground"
                />
                <p className="text-xs text-muted-foreground mt-1.5">
                  Ekspor dulu file dari cabang ini untuk template. Kolom kosong = lewati (nilai lama dipertahankan).
                </p>
              </div>

              <div className="rounded-md bg-muted/40 border border-border px-3 py-2.5 text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Aturan impor</p>
                <ul className="list-disc ml-4 space-y-0.5">
                  <li>Kolom wajib: <code className="text-foreground">sku, satuan</code> atau <code className="text-foreground">nama_produk, satuan</code></li>
                  <li>Kolom nilai: <code className="text-foreground">modal, harga_retail, harga_reseller, harga_grosir, harga_member</code></li>
                  <li>Sel kosong = lewati. Harga &gt; 0. Modal ≥ 0.</li>
                  <li>Produk dicari berdasarkan SKU dulu, jika kosong pakai nama produk (harus unik).</li>
                </ul>
              </div>
            </div>
          )}

          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Summary cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                <SummaryCard label="Total baris" value={preview.summary.totalRows} />
                <SummaryCard label="Baru" value={preview.summary.insertCount} tone="green" />
                <SummaryCard label="Ubah" value={preview.summary.updateCount} tone="blue" />
                <SummaryCard label="Sama" value={preview.summary.unchangedCount} tone="muted" />
                <SummaryCard label="Ditolak" value={preview.summary.rejectedCount} tone="red" />
                <SummaryCard
                  label="Total nilai berubah"
                  value={preview.summary.priceChangeCount + preview.summary.costChangeCount}
                  tone="primary"
                />
              </div>

              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  Cabang tujuan: <span className="font-medium text-foreground">{targetBranchName}</span>
                </p>
                <label className="text-xs flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOnlyChanged}
                    onChange={e => setShowOnlyChanged(e.target.checked)}
                  />
                  Sembunyikan baris tanpa perubahan
                </label>
              </div>

              {/* Rows table */}
              <div className="rounded-md border border-border overflow-x-auto max-h-[50vh] overflow-y-auto">
                <table className="w-full text-xs border-collapse">
                  <thead className="bg-muted/50 sticky top-0 z-10">
                    <tr>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-[50px] border-b border-border">Baris</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-[80px] border-b border-border">Status</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground border-b border-border">Produk</th>
                      <th className="text-left px-2 py-2 font-medium text-muted-foreground w-[80px] border-b border-border">Satuan</th>
                      <th className="text-right px-2 py-2 font-medium text-muted-foreground border-b border-border">Perubahan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map(r => (
                      <tr key={r.rowNumber} className="border-b border-border last:border-0">
                        <td className="px-2 py-1.5 text-muted-foreground">{r.rowNumber}</td>
                        <td className="px-2 py-1.5">
                          <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-medium ${STATUS_CLASS[r.status]}`}>
                            {STATUS_LABEL[r.status]}
                          </span>
                        </td>
                        <td className="px-2 py-1.5">
                          <div className="font-medium text-foreground">
                            {r.productName ?? r.namaProduk ?? '—'}
                          </div>
                          {r.sku && <div className="text-[10px] text-muted-foreground">SKU: {r.sku}</div>}
                          {r.status === 'rejected' && r.reason && (
                            <div className="text-[10px] text-destructive flex items-center gap-1 mt-0.5">
                              <AlertCircle className="w-3 h-3" />
                              {r.reason}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-foreground">{r.uomCode ?? r.satuan ?? '—'}</td>
                        <td className="px-2 py-1.5">
                          <FieldChanges fields={r.fields} />
                        </td>
                      </tr>
                    ))}
                    {visibleRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center py-8 text-muted-foreground">
                          {showOnlyChanged ? 'Tidak ada baris dengan perubahan.' : 'Tidak ada baris di file.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {step === 'applying' && (
            <div className="text-center py-16">
              <div className="animate-pulse text-sm text-muted-foreground">
                Menyimpan {preview?.summary.priceChangeCount ?? 0} harga dan {preview?.summary.costChangeCount ?? 0} modal ke database...
              </div>
              <p className="text-xs text-muted-foreground/70 mt-2">Jangan tutup jendela ini.</p>
            </div>
          )}

          {errorMsg && (
            <div className="mt-3 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center gap-2 px-5 py-4 border-t border-border">
          <div className="text-xs text-muted-foreground">
            {step === 'preview' && preview && (
              <>
                <FileSpreadsheet className="w-3 h-3 inline mr-1" />
                Sesi berlaku {Math.floor(preview.expiresInSec / 60)} menit
              </>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              disabled={isBusy}
              className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              {step === 'preview' ? 'Batal' : 'Tutup'}
            </button>
            {step === 'upload' && (
              <button
                onClick={handleUpload}
                disabled={!file || isBusy}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-3.5 h-3.5" />
                {isBusy ? 'Memproses...' : 'Pratinjau'}
              </button>
            )}
            {step === 'preview' && preview && (
              <button
                onClick={handleApply}
                disabled={isBusy || (preview.summary.priceChangeCount + preview.summary.costChangeCount) === 0}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Terapkan {preview.summary.priceChangeCount + preview.summary.costChangeCount} perubahan
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'blue' | 'red' | 'muted' | 'primary' }) {
  const toneClass =
    tone === 'green' ? 'text-green-700 bg-green-50 border-green-200'
    : tone === 'blue' ? 'text-blue-700 bg-blue-50 border-blue-200'
    : tone === 'red' ? 'text-destructive bg-destructive/10 border-destructive/30'
    : tone === 'muted' ? 'text-muted-foreground bg-muted/40 border-border'
    : tone === 'primary' ? 'text-primary bg-primary/10 border-primary/30'
    : 'text-foreground bg-muted/40 border-border'
  return (
    <div className={`rounded-md border px-3 py-2 ${toneClass}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-80">{label}</div>
      <div className="text-lg font-semibold">{value.toLocaleString('id-ID')}</div>
    </div>
  )
}

function FieldChanges({ fields }: { fields: PreviewRow['fields'] }) {
  const entries = Object.entries(fields).filter(([, v]) => v && v.action !== 'unchanged') as [string, { old: number | null; new: number; action: 'insert' | 'update' }][]
  if (entries.length === 0) return <span className="text-muted-foreground/60 text-right block">—</span>
  return (
    <div className="text-right space-y-0.5">
      {entries.map(([field, val]) => (
        <div key={field} className="text-[11px]">
          <span className="text-muted-foreground">{fieldLabel(field)}:</span>{' '}
          <span className="text-muted-foreground/60">{val.old === null ? '—' : val.old.toLocaleString('id-ID')}</span>
          <span className="mx-1 text-muted-foreground">→</span>
          <span className="font-medium text-foreground">{val.new.toLocaleString('id-ID')}</span>
        </div>
      ))}
    </div>
  )
}

function fieldLabel(field: string): string {
  switch (field) {
    case 'modal': return 'Modal'
    case 'harga_retail': return 'Retail'
    case 'harga_reseller': return 'Reseller'
    case 'harga_grosir': return 'Grosir'
    case 'harga_member': return 'Member'
    default: return field
  }
}
