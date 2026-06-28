'use client'

import { useMemo, useState } from 'react'
import { Printer, Loader2, Check, X, Barcode as BarcodeIcon, Search } from 'lucide-react'
import BarcodeSvg from './barcode-svg'
import { LABEL_PRESETS, type BarcodeProduct } from './types'

interface Props {
  initialProducts: BarcodeProduct[]
}

export default function BarcodePrintClient({ initialProducts }: Props) {
  const [products, setProducts] = useState<BarcodeProduct[]>(initialProducts)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const [copies, setCopies] = useState(1)
  const [startOffset, setStartOffset] = useState(0)
  const [presetId, setPresetId] = useState(LABEL_PRESETS[0].id)
  const [showName, setShowName] = useState(true)
  const [showCode, setShowCode] = useState(true)

  const preset = LABEL_PRESETS.find((p) => p.id === presetId) ?? LABEL_PRESETS[0]

  function flash(type: 'ok' | 'err', text: string) {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 3500)
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.sku ?? '').toLowerCase().includes(q) ||
        (p.categoryName ?? '').toLowerCase().includes(q),
    )
  }, [products, search])

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    const allSelected = filtered.every((p) => selected.has(p.id))
    setSelected((prev) => {
      const next = new Set(prev)
      for (const p of filtered) {
        if (allSelected) next.delete(p.id)
        else next.add(p.id)
      }
      return next
    })
  }

  const selectedProducts = useMemo(
    () => products.filter((p) => selected.has(p.id)),
    [products, selected],
  )
  const needGenerate = selectedProducts.filter((p) => !p.barcode)
  const printable = selectedProducts.filter((p) => p.barcode)

  async function generateSelected() {
    if (needGenerate.length === 0) return
    setGenerating(true)
    try {
      const res = await fetch('/api/bo/products/generate-barcodes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds: needGenerate.map((p) => p.id) }),
      })
      const data = await res.json()
      if (!res.ok) {
        flash('err', data.error ?? 'Gagal membuat barcode')
        return
      }
      const map = new Map<number, string>(
        (data.generated as { id: number; barcode: string }[]).map((g) => [g.id, g.barcode]),
      )
      setProducts((prev) => prev.map((p) => (map.has(p.id) ? { ...p, barcode: map.get(p.id)! } : p)))
      flash('ok', `${map.size} barcode berhasil dibuat`)
    } catch {
      flash('err', 'Terjadi kesalahan jaringan')
    } finally {
      setGenerating(false)
    }
  }

  const cells = useMemo(() => {
    const list: (BarcodeProduct | null)[] = []
    for (let i = 0; i < startOffset; i++) list.push(null)
    for (const p of printable) {
      for (let c = 0; c < copies; c++) list.push(p)
    }
    return list
  }, [printable, copies, startOffset])

  const barcodeHeightMm = Math.max(8, preset.labelHeightMm * (showName ? 0.45 : 0.6))

  return (
    <div className="space-y-6">
      {msg && (
        <div
          className={`no-print flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${
            msg.type === 'ok' ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive'
          }`}
        >
          {msg.type === 'ok' ? <Check className="w-4 h-4 shrink-0" /> : <X className="w-4 h-4 shrink-0" />}
          {msg.text}
        </div>
      )}

      <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daftar produk */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              Produk tanpa barcode <span className="text-muted-foreground">({products.length})</span>
            </h2>
            <span className="text-xs text-muted-foreground">{selected.size} dipilih</span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama / SKU / kategori"
              className="w-full pl-9 pr-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur">
                  <tr className="border-b border-border">
                    <th className="w-10 px-3 py-2">
                      <input
                        type="checkbox"
                        aria-label="Pilih semua"
                        checked={filtered.length > 0 && filtered.every((p) => selected.has(p.id))}
                        onChange={toggleAllFiltered}
                      />
                    </th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nama</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">SKU</th>
                    <th className="text-left px-3 py-2 font-medium text-muted-foreground">Barcode</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((p) => (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                          aria-label={`Pilih ${p.name}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-foreground">{p.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{p.sku ?? '-'}</td>
                      <td className="px-3 py-2">
                        {p.barcode ? (
                          <span className="font-mono text-xs text-green-600">{p.barcode}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">belum</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground text-sm">
                        {products.length === 0 ? 'Semua produk sudah punya barcode.' : 'Tidak ada produk cocok.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Pengaturan cetak */}
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-foreground">Pengaturan cetak</h2>

          <div className="bg-card border border-border rounded-lg p-4 space-y-4">
            <button
              type="button"
              onClick={generateSelected}
              disabled={generating || needGenerate.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <BarcodeIcon className="w-4 h-4" />}
              {needGenerate.length > 0
                ? `Generate barcode untuk ${needGenerate.length} produk`
                : 'Semua terpilih sudah punya barcode'}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">
                <span className="text-muted-foreground">Layout lembar</span>
                <select
                  value={presetId}
                  onChange={(e) => setPresetId(e.target.value)}
                  className="mt-1 w-full px-2 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {LABEL_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">Jumlah label / produk</span>
                <input
                  type="number"
                  min={1}
                  value={copies}
                  onChange={(e) => setCopies(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-1 w-full px-2 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <label className="text-sm">
                <span className="text-muted-foreground">Lewati sel awal</span>
                <input
                  type="number"
                  min={0}
                  value={startOffset}
                  onChange={(e) => setStartOffset(Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1 w-full px-2 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </label>
              <div className="text-sm flex flex-col justify-end gap-1.5">
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />
                  Tampilkan nama
                </label>
                <label className="flex items-center gap-2 text-muted-foreground">
                  <input type="checkbox" checked={showCode} onChange={(e) => setShowCode(e.target.checked)} />
                  Tampilkan kode
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">
                {printable.length} produk siap · {cells.length - startOffset} label
              </span>
              <button
                type="button"
                onClick={() => window.print()}
                disabled={printable.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-foreground text-background rounded-lg text-sm font-semibold disabled:opacity-50"
              >
                <Printer className="w-4 h-4" />
                Cetak
              </button>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Tip: pada dialog cetak, set Margin ke <strong>Default</strong> dan Scale <strong>100%</strong> agar ukuran
            label presisi. Gunakan &quot;Simpan sebagai PDF&quot; bila ingin file.
          </p>
        </div>
      </div>

      {/* Area preview & cetak */}
      <div className="space-y-2">
        <p className="no-print text-sm font-semibold text-foreground">Preview lembar</p>
        <div className="bg-muted/30 rounded-lg p-4 overflow-x-auto print:bg-transparent print:p-0">
          <div
            id="barcode-print-area"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${preset.columns}, ${preset.labelWidthMm}mm)`,
              gap: `${preset.gapMm}mm`,
              justifyContent: 'start',
            }}
          >
            {cells.map((p, i) => (
              <div
                key={i}
                style={{ width: `${preset.labelWidthMm}mm`, height: `${preset.labelHeightMm}mm` }}
                className="flex flex-col items-center justify-center overflow-hidden border border-dashed border-border/60 print:border-transparent"
              >
                {p && (
                  <>
                    {showName && (
                      <div className="w-full px-1 text-center text-[8px] leading-tight text-black truncate">
                        {p.name}
                      </div>
                    )}
                    <BarcodeSvg value={p.barcode!} heightMm={barcodeHeightMm} showValue={showCode} />
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #barcode-print-area, #barcode-print-area * { visibility: visible !important; }
          #barcode-print-area { position: absolute; left: 0; top: 0; }
          .no-print { display: none !important; }
          @page { size: A4; margin: 8mm; }
        }
      `}</style>
    </div>
  )
}
