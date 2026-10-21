'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { NewBadge } from '@/components/ui/new-badge'

// Tombol + modal "Hitung Ulang" di detail SO Besar yang sudah disetujui. Membuat dokumen
// koreksi tertaut (lihat so-recount-service), lalu mengarahkan ke halaman persetujuan SO
// tempat qty fisik ke-2 diisi.
export default function RecountStart({ soId }: { soId: number }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit() {
    if (!notes.trim()) {
      setError('Catatan wajib diisi — jelaskan kenapa SO ini dihitung ulang')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/bo/stock-opnames/${soId}/recount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notes.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Gagal membuat dokumen hitung ulang (${res.status})`)
        return
      }
      toast.success(`Dokumen hitung ulang ${data.so?.soNumber ?? ''} dibuat — isi qty fisik ke-2 di halaman persetujuan`)
      router.push('/inventory/stock-opname')
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          setNotes('')
          setError(null)
        }}
        className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-sky-700 border border-sky-300 rounded-md hover:bg-sky-50 dark:text-sky-300 dark:border-sky-800 dark:hover:bg-sky-950/40 transition-all"
      >
        Hitung Ulang
        <NewBadge feature="fitur/so-hitung-ulang" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" role="presentation" onClick={() => !submitting && setOpen(false)} />
          <div
            className="fixed inset-x-4 top-1/4 z-50 mx-auto max-w-lg rounded-2xl bg-background p-5 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-label="Hitung Ulang Stock Opname"
          >
            <h2 className="text-base font-semibold text-foreground">Hitung Ulang SO ini</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Membuat dokumen verifikasi tertaut ke SO ini. Hanya item yang berselisih yang diisi ulang;
              pembanding = stok sistem terkini (semua transaksi sejak SO ini sudah diperhitungkan). Lakukan
              sedekat mungkin dengan tanggal SO ini agar selisihnya bersih. Stok dikoreksi hanya jika Anda
              menyetujui tiap item nanti.
            </p>

            <label className="mt-4 block text-xs font-medium text-foreground">Catatan (wajib)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              disabled={submitting}
              placeholder="Mis. ragu pada hasil hitung minus beberapa produk, ingin verifikasi fisik ulang"
              className="mt-1 w-full rounded-md border border-input px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none disabled:opacity-50"
            />

            {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium border border-border rounded-md hover:bg-accent transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting || !notes.trim()}
                className="px-4 py-2 text-sm font-medium bg-sky-600 text-white rounded-md hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? 'Membuat...' : 'Buat & Mulai Hitung Ulang'}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  )
}
