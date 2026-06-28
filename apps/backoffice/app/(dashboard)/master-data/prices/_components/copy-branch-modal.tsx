'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { Branch } from './types'

interface Props {
  branches: Branch[]
  targetBranchId: number
  targetBranchName: string
  onClose: () => void
  onSuccess: (copied: number) => void
}

export default function CopyBranchModal({ branches, targetBranchId, targetBranchName, onClose, onSuccess }: Props) {
  const sourceBranches = branches.filter(b => b.id !== targetBranchId)

  const [sourceBranchId, setSourceBranchId] = useState<number>(sourceBranches[0]?.id ?? 0)
  const [markupPercent, setMarkupPercent] = useState<string>('0')
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [previewCostCount, setPreviewCostCount] = useState<number | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [isCopying, setIsCopying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch preview count whenever source branch changes
  useEffect(() => {
    if (!sourceBranchId) return
    let cancelled = false
    setIsLoadingPreview(true)
    setPreviewCount(null)
    setPreviewCostCount(null)

    fetch(`/api/bo/master-data/prices/copy-branch?preview=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceBranchId, targetBranchId, markupPercent: 0 }),
    })
      .then(r => r.json())
      .then((d: { total?: number; costTotal?: number; error?: string }) => {
        if (!cancelled) {
          setPreviewCount(d.total ?? 0)
          setPreviewCostCount(d.costTotal ?? 0)
        }
      })
      .catch(() => { if (!cancelled) { setPreviewCount(null); setPreviewCostCount(null) } })
      .finally(() => { if (!cancelled) setIsLoadingPreview(false) })

    return () => { cancelled = true }
  }, [sourceBranchId, targetBranchId])

  async function handleCopy() {
    if (!sourceBranchId) return
    const markup = parseFloat(markupPercent.replace(',', '.'))
    if (isNaN(markup) || markup < -99 || markup > 999) {
      setErrorMsg('Markup harus antara -99% dan 999%')
      return
    }

    setIsCopying(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/bo/master-data/prices/copy-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceBranchId, targetBranchId, markupPercent: markup }),
      })
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error ?? 'Gagal menyalin harga')
      const json = await res.json() as { copied: number }
      onSuccess(json.copied)
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsCopying(false)
    }
  }

  const sourceName = sourceBranches.find(b => b.id === sourceBranchId)?.name ?? '-'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Salin Harga dari Cabang Lain</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Target info */}
          <div className="bg-muted/40 rounded-md px-3 py-2 text-sm">
            <span className="text-muted-foreground">Cabang tujuan: </span>
            <span className="font-medium text-foreground">{targetBranchName}</span>
          </div>

          {/* Source branch */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Cabang sumber
            </label>
            {sourceBranches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada cabang lain tersedia</p>
            ) : (
              <select
                value={sourceBranchId}
                onChange={e => setSourceBranchId(Number(e.target.value))}
                className="w-full border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              >
                {sourceBranches.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Markup */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Markup (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.1"
                value={markupPercent}
                onChange={e => setMarkupPercent(e.target.value)}
                className="w-32 border border-border rounded-md px-3 py-2 text-sm bg-background text-foreground"
              />
              <span className="text-sm text-muted-foreground">
                {parseFloat(markupPercent || '0') === 0
                  ? '— salin harga tanpa perubahan'
                  : parseFloat(markupPercent) > 0
                    ? `— harga dinaikkan ${markupPercent}%`
                    : `— harga diturunkan ${Math.abs(parseFloat(markupPercent))}%`}
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Contoh: 10 = naik 10%, -5 = turun 5%, 0 = salin sama persis
            </p>
          </div>

          {/* Preview */}
          <div className="bg-muted/40 rounded-md px-3 py-2.5 text-sm">
            {isLoadingPreview ? (
              <span className="text-muted-foreground">Menghitung jumlah harga...</span>
            ) : previewCount !== null && previewCostCount !== null ? (
              <>
                <span className="font-medium text-foreground">{previewCount.toLocaleString('id-ID')}</span>
                <span className="text-muted-foreground"> harga jual </span>
                {previewCostCount > 0 && (
                  <>
                    <span className="text-muted-foreground">dan </span>
                    <span className="font-medium text-foreground">{previewCostCount.toLocaleString('id-ID')}</span>
                    <span className="text-muted-foreground"> harga modal </span>
                  </>
                )}
                <span className="text-muted-foreground">dari </span>
                <span className="font-medium text-foreground">{sourceName}</span>
                <span className="text-muted-foreground"> akan disalin ke </span>
                <span className="font-medium text-foreground">{targetBranchName}</span>
                <span className="text-muted-foreground">. Harga yang sudah ada akan ditimpa.</span>
              </>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </div>

          {errorMsg && (
            <p className="text-sm text-destructive">{errorMsg}</p>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isCopying}
            className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted/50 transition-colors disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={handleCopy}
            disabled={isCopying || sourceBranches.length === 0 || previewCount === 0}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCopying ? 'Menyalin...' : 'Salin Sekarang'}
          </button>
        </div>
      </div>
    </div>
  )
}
