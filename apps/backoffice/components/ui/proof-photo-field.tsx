'use client'

import { useRef, useState } from 'react'
import { Camera, Loader2, X } from 'lucide-react'
import { NewBadge } from '@/components/ui/new-badge'

const MAX_SIDE = 1600

/** Perkecil foto di browser sebelum diunggah supaya hemat kuota & ruang server. */
async function shrinkImage(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    return blob && blob.size < file.size ? blob : file
  } catch {
    return file
  }
}

/**
 * Foto bukti transfer — opsional. Mengunggah begitu dipilih; `onChange` menerima alamat fotonya
 * (atau null bila dihapus), `onUploadingChange` dipakai form untuk menahan Simpan selama unggah.
 */
export function ProofPhotoField({
  value,
  onChange,
  onUploadingChange,
  disabled,
}: {
  value: string | null
  onChange: (url: string | null) => void
  onUploadingChange?: (uploading: boolean) => void
  disabled?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setBusy = (busy: boolean) => {
    setUploading(busy)
    onUploadingChange?.(busy)
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setBusy(true)
    try {
      const blob = await shrinkImage(file)
      const form = new FormData()
      form.append('file', blob, blob === file ? file.name : 'bukti.jpg')
      const res = await fetch('/api/pos/uploads', { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Gagal mengunggah foto')
        return
      }
      onChange(data.url)
    } catch {
      setError('Terjadi kesalahan jaringan saat unggah foto')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <label className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
        Foto Bukti Transfer <NewBadge feature="fitur/foto-bukti-transfer" />
      </label>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
      {value ? (
        <div className="flex items-center gap-3">
          <a href={value} target="_blank" rel="noopener noreferrer" aria-label="Lihat foto bukti transfer">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Foto bukti transfer" className="h-16 w-16 rounded-md object-cover border border-border" />
          </a>
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <X className="h-3 w-3" /> Hapus foto
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-md border border-dashed border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          {uploading ? 'Mengunggah...' : 'Pilih / ambil foto'}
        </button>
      )}
      <p className="mt-1 text-xs text-muted-foreground">Opsional — memudahkan pengecekan nanti.</p>
      {error && <p role="alert" className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  )
}

/** Tautan kecil di riwayat pembayaran untuk membuka foto bukti di tab baru. */
export function ProofPhotoLink({ url }: { url: string | null | undefined }) {
  if (!url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <Camera className="h-3 w-3" /> Lihat bukti
    </a>
  )
}
