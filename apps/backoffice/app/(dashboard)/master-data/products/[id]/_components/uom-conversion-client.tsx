'use client'

import { useState, useEffect } from 'react'
import UomConversionForm from './uom-conversion-form'

interface UomConversion {
  id: number
  uomId: number | null
  uomCode: string | null
  uomName: string | null
  ratio: number | null
  weightGram: number | null
}

interface UomOption {
  id: number
  code: string
  name: string
}

interface Props {
  productId: number
  initialConversions: UomConversion[]
  availableUoms: UomOption[]
  baseUomId: number
}

export default function UomConversionClient({
  productId,
  initialConversions,
  availableUoms,
  baseUomId,
}: Props) {
  const [conversions, setConversions] = useState<UomConversion[]>(initialConversions)
  const [uomsList, setUomsList] = useState<UomOption[]>(availableUoms)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!successMsg) return
    const t = setTimeout(() => setSuccessMsg(null), 3000)
    return () => clearTimeout(t)
  }, [successMsg])

  async function refreshConversions() {
    try {
      const res = await fetch(`/api/bo/master-data/products/${productId}/uom-conversions`)
      if (!res.ok) {
        setErrorMsg('Gagal memperbarui daftar konversi')
        return
      }
      const data = await res.json()
      setConversions(data)
      setErrorMsg(null)
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan saat memperbarui daftar')
    }
  }

  async function handleDelete(convId: number) {
    if (!window.confirm('Hapus konversi UOM ini?')) return
    setDeletingId(convId)
    try {
      const res = await fetch(
        `/api/bo/master-data/products/${productId}/uom-conversions/${convId}`,
        { method: 'DELETE' }
      )
      if (!res.ok) {
        const data = await res.json()
        setErrorMsg(data.error ?? 'Gagal menghapus konversi')
        setSuccessMsg(null)
      } else {
        setSuccessMsg('Konversi UOM berhasil dihapus')
        setErrorMsg(null)
        await refreshConversions()
      }
    } catch {
      setErrorMsg('Terjadi kesalahan jaringan')
      setSuccessMsg(null)
    } finally {
      setDeletingId(null)
    }
  }

  async function handleAddSuccess() {
    setSuccessMsg('Konversi UOM berhasil ditambahkan')
    setErrorMsg(null)
    setShowForm(false)
    await refreshConversions()
  }

  return (
    <div>
      {/* Banner feedback */}
      {successMsg && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-green-50 border border-green-200 text-green-800"
        >
          {successMsg}
        </div>
      )}
      {errorMsg && !successMsg && (
        <div
          role="alert"
          aria-live="assertive"
          className="mb-4 px-4 py-3 rounded-md text-sm bg-destructive/10 border border-destructive/20 text-destructive"
        >
          {errorMsg}
        </div>
      )}

      {/* Header aksi */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          Konfigurasi konversi satuan tambahan untuk produk ini. Kasir dapat menjual dalam satuan
          yang berbeda dengan harga yang sesuai.
        </p>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors whitespace-nowrap ml-4"
          >
            + Tambah UOM
          </button>
        )}
      </div>

      {/* Form tambah */}
      {showForm && (
        <div className="mb-6 p-4 border border-border rounded-lg bg-muted/20">
          <h3 className="text-sm font-medium text-foreground mb-3">Tambah Konversi UOM</h3>
          <UomConversionForm
            productId={productId}
            availableUoms={uomsList}
            baseUomId={baseUomId}
            existingUomIds={conversions.map((c) => c.uomId).filter((id): id is number => id !== null)}
            onSuccess={handleAddSuccess}
            onCancel={() => setShowForm(false)}
            onNewUomCreated={(uom) => setUomsList((prev) => [...prev, uom])}
          />
        </div>
      )}

      {/* Tabel konversi */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">UOM</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Kode</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Ratio (per 1 UOM ini = N × UOM Dasar)
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Berat (gram)
                </th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {conversions.map((conv) => (
                <tr
                  key={conv.id}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-foreground">{conv.uomName ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{conv.uomCode ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{conv.ratio ?? '-'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{conv.weightGram ?? '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(conv.id)}
                      disabled={deletingId === conv.id}
                      className="px-2.5 py-1 text-xs font-medium text-destructive border border-destructive/30 rounded-md hover:bg-destructive/10 transition-colors disabled:opacity-50"
                    >
                      {deletingId === conv.id ? '...' : 'Hapus'}
                    </button>
                  </td>
                </tr>
              ))}
              {conversions.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-8 text-center text-muted-foreground text-sm"
                  >
                    Belum ada konversi UOM. Klik &quot;+ Tambah UOM&quot; untuk menambahkan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
