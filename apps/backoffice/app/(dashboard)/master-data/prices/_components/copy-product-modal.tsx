'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Search } from 'lucide-react'

interface SearchResult {
  id: number
  sku: string | null
  name: string
}

interface PreviewRow {
  uomId: number
  uomCode: string
  uomName: string
  ratio: number | null
  weightGram: number | null
  prices: Record<string, number>
  costPrice: number | null
  targetExistingRatio: number | null
  copyable: boolean
  blockReason: string | null
}

interface Props {
  targetProductId: number
  targetProductName: string
  branchId: number
  branchName: string
  displayTiers: readonly string[]
  onClose: () => void
  onSuccess: (summary: string) => void
}

function fmt(n: number): string {
  return n.toLocaleString('id-ID')
}

export default function CopyProductModal({
  targetProductId,
  targetProductName,
  branchId,
  branchName,
  displayTiers,
  onClose,
  onSuccess,
}: Props) {
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [source, setSource] = useState<SearchResult | null>(null)
  const [previewRows, setPreviewRows] = useState<PreviewRow[] | null>(null)
  const [isLoadingPreview, setIsLoadingPreview] = useState(false)
  const [selectedUomIds, setSelectedUomIds] = useState<Set<number>>(new Set())
  const [isCopying, setIsCopying] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const searchAbort = useRef<AbortController | null>(null)

  // Cari produk sumber (debounced)
  useEffect(() => {
    if (source) return
    if (search.trim().length < 2) { setResults([]); return }
    const t = setTimeout(async () => {
      searchAbort.current?.abort()
      const ctrl = new AbortController()
      searchAbort.current = ctrl
      setIsSearching(true)
      try {
        const res = await fetch(`/api/products?q=${encodeURIComponent(search.trim())}&limit=10`, { signal: ctrl.signal })
        if (res.ok) {
          const data = (await res.json()) as SearchResult[]
          setResults(data.filter((p) => p.id !== targetProductId))
        }
      } catch { /* diabaikan (abort/network) */ } finally {
        setIsSearching(false)
      }
    }, 350)
    return () => clearTimeout(t)
  }, [search, source, targetProductId])

  // Ambil preview setelah produk sumber dipilih
  useEffect(() => {
    if (!source) return
    let cancelled = false
    setIsLoadingPreview(true)
    setPreviewRows(null)
    setErrorMsg(null)
    fetch('/api/bo/master-data/prices/copy-product?preview=1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceProductId: source.id, targetProductId, branchId }),
    })
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Gagal memuat preview')
        return data as { rows: PreviewRow[] }
      })
      .then((data) => {
        if (cancelled) return
        setPreviewRows(data.rows)
        setSelectedUomIds(new Set(data.rows.filter((r) => r.copyable).map((r) => r.uomId)))
      })
      .catch((e: Error) => { if (!cancelled) setErrorMsg(e.message) })
      .finally(() => { if (!cancelled) setIsLoadingPreview(false) })
    return () => { cancelled = true }
  }, [source, targetProductId, branchId])

  function toggleUom(uomId: number) {
    setSelectedUomIds((prev) => {
      const next = new Set(prev)
      if (next.has(uomId)) next.delete(uomId)
      else next.add(uomId)
      return next
    })
  }

  async function handleCopy() {
    if (!source || selectedUomIds.size === 0) return
    setIsCopying(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/bo/master-data/prices/copy-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceProductId: source.id,
          targetProductId,
          branchId,
          uomIds: [...selectedUomIds],
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Gagal menyalin')
      const parts: string[] = []
      if (data.createdConversions > 0) parts.push(`${data.createdConversions} satuan (global)`)
      if (data.copiedPrices > 0) parts.push(`${data.copiedPrices} harga`)
      if (data.copiedCosts > 0) parts.push(`${data.copiedCosts} modal`)
      onSuccess(parts.length > 0 ? `Disalin dari ${source.name}: ${parts.join(', ')}` : 'Tidak ada yang disalin')
    } catch (e: unknown) {
      setErrorMsg((e as Error).message)
    } finally {
      setIsCopying(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background border border-border rounded-lg shadow-xl w-full max-w-3xl mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Salin Satuan &amp; Harga dari Produk Lain</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tujuan: <span className="font-medium text-foreground">{targetProductName}</span> · Harga &amp; modal
              disalin untuk cabang <span className="font-medium text-foreground">{branchName}</span>; konversi
              satuan berlaku <span className="font-medium text-amber-600">GLOBAL</span>
            </p>
          </div>
          <button onClick={onClose} disabled={isCopying} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Pilih produk sumber */}
          {!source ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Produk sumber</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  autoFocus
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Cari nama / SKU produk..."
                  className="w-full border border-border rounded-md pl-9 pr-3 py-2 text-sm bg-background text-foreground"
                />
              </div>
              {isSearching && <p className="text-xs text-muted-foreground mt-2">Mencari...</p>}
              {!isSearching && results.length > 0 && (
                <ul className="mt-2 border border-border rounded-md divide-y divide-border max-h-56 overflow-y-auto">
                  {results.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => setSource(p)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors"
                      >
                        <span className="font-medium text-foreground">{p.name}</span>
                        {p.sku && <span className="ml-2 text-xs text-muted-foreground font-mono">{p.sku}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!isSearching && search.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-muted-foreground mt-2">Tidak ada produk ditemukan</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-muted/40 rounded-md px-3 py-2 text-sm">
              <span>
                <span className="text-muted-foreground">Sumber: </span>
                <span className="font-medium text-foreground">{source.name}</span>
              </span>
              <button
                onClick={() => { setSource(null); setPreviewRows(null); setSearch('') }}
                disabled={isCopying}
                className="text-xs text-primary hover:underline"
              >
                ganti
              </button>
            </div>
          )}

          {/* Preview */}
          {source && isLoadingPreview && (
            <p className="text-sm text-muted-foreground py-2">Memuat satuan &amp; harga sumber...</p>
          )}
          {source && !isLoadingPreview && previewRows && previewRows.length === 0 && (
            <p className="text-sm text-muted-foreground py-2">
              Produk sumber tidak punya harga di cabang {branchName}.
            </p>
          )}
          {source && !isLoadingPreview && previewRows && previewRows.length > 0 && (
            <div className="rounded-md border border-border overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 border-b border-border w-[36px]" />
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground border-b border-border">Satuan</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground border-b border-border">Ratio</th>
                    <th className="text-right px-3 py-2 font-medium text-amber-600 border-b border-border">Modal</th>
                    {displayTiers.map((tier) => (
                      <th key={tier} className="text-right px-3 py-2 font-medium text-muted-foreground border-b border-border">
                        {tier}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.uomId} className={row.copyable ? '' : 'opacity-60'}>
                      <td className="px-3 py-2 border-b border-border/50">
                        <input
                          type="checkbox"
                          checked={selectedUomIds.has(row.uomId)}
                          disabled={!row.copyable || isCopying}
                          onChange={() => toggleUom(row.uomId)}
                        />
                      </td>
                      <td className="px-3 py-2 border-b border-border/50 font-mono text-xs">{row.uomCode}</td>
                      <td className="px-3 py-2 border-b border-border/50 text-xs">
                        {row.ratio === null ? (
                          <span className="text-muted-foreground">dasar</span>
                        ) : (
                          <>
                            = {fmt(row.ratio)}
                            {row.targetExistingRatio !== null && row.targetExistingRatio === row.ratio && (
                              <span className="ml-1 text-muted-foreground">(sudah ada, sama)</span>
                            )}
                          </>
                        )}
                        {!row.copyable && (
                          <p className="text-destructive text-[11px] mt-0.5">{row.blockReason}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 border-b border-border/50 text-right text-xs text-amber-700">
                        {row.costPrice !== null ? fmt(row.costPrice) : '—'}
                      </td>
                      {displayTiers.map((tier) => (
                        <td key={tier} className="px-3 py-2 border-b border-border/50 text-right text-xs">
                          {row.prices[tier] !== undefined ? fmt(row.prices[tier]) : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {errorMsg && <p className="text-sm text-destructive">{errorMsg}</p>}
        </div>

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
            disabled={isCopying || !source || selectedUomIds.size === 0}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCopying ? 'Menyalin...' : `Salin (${selectedUomIds.size} satuan)`}
          </button>
        </div>
      </div>
    </div>
  )
}
