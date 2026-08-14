'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

type Status = 'STOPPED' | 'STARTING' | 'SCAN_QR_CODE' | 'WORKING' | 'FAILED' | 'UNKNOWN'

interface Sesi {
  status: Status
  me: { id?: string; pushName?: string } | null
}

const LABEL: Record<Status, { teks: string; kelas: string }> = {
  WORKING: { teks: 'Tertaut & siap', kelas: 'bg-green-50 border-green-200 text-green-800' },
  SCAN_QR_CODE: { teks: 'Menunggu pemindaian QR', kelas: 'bg-amber-50 border-amber-200 text-amber-800' },
  STARTING: { teks: 'Sedang menyalakan…', kelas: 'bg-amber-50 border-amber-200 text-amber-800' },
  STOPPED: { teks: 'Berhenti', kelas: 'bg-muted border-border text-muted-foreground' },
  FAILED: { teks: 'Gagal', kelas: 'bg-destructive/10 border-destructive/20 text-destructive' },
  UNKNOWN: { teks: 'Tidak diketahui', kelas: 'bg-muted border-border text-muted-foreground' },
}

export default function WhatsappClient({ awal }: { awal: Sesi | null }) {
  const [sesi, setSesi] = useState<Sesi | null>(awal)
  const [error, setError] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
  // Dipakai untuk memaksa <img> mengambil ulang QR; WAHA menggantinya berkala.
  const [qrNonce, setQrNonce] = useState(0)
  const konfirmasiPutus = useRef(false)

  const muat = useCallback(async () => {
    try {
      const res = await fetch('/api/bo/settings/whatsapp', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Gagal memuat status (${res.status})`)
        return
      }
      setSesi(data)
      setError(null)
    } catch {
      setError('Tidak bisa menghubungi server')
    }
  }, [])

  // Selama menunggu QR, status berubah cepat dan QR-nya kedaluwarsa tiap ~20 detik,
  // jadi disegarkan lebih sering. Saat sudah tertaut, cukup sesekali.
  useEffect(() => {
    const menunggu = sesi?.status === 'SCAN_QR_CODE' || sesi?.status === 'STARTING'
    const jeda = menunggu ? 5000 : 20000
    const t = setInterval(() => {
      muat()
      if (menunggu) setQrNonce((n) => n + 1)
    }, jeda)
    return () => clearInterval(t)
  }, [muat, sesi?.status])

  async function aksi(nama: 'mulai' | 'putuskan' | 'nyalakan_ulang') {
    // Memutus tautan menghentikan seluruh OTP pelanggan sampai ada yang memindai
    // QR lagi — jangan sampai kepencet tanpa sadar.
    if (nama === 'putuskan' && !konfirmasiPutus.current) {
      konfirmasiPutus.current = true
      setError('Tekan sekali lagi untuk memastikan: OTP pelanggan berhenti sampai ditautkan ulang.')
      setTimeout(() => { konfirmasiPutus.current = false }, 5000)
      return
    }
    konfirmasiPutus.current = false

    setSibuk(nama)
    setError(null)
    try {
      const res = await fetch('/api/bo/settings/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aksi: nama }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Aksi gagal (${res.status})`)
        return
      }
      setSesi(data)
      setQrNonce((n) => n + 1)
    } catch {
      setError('Tidak bisa menghubungi server')
    } finally {
      setSibuk(null)
    }
  }

  const status = sesi?.status ?? 'UNKNOWN'
  const label = LABEL[status]
  const nomor = sesi?.me?.id?.replace(/@c\.us$/, '')

  return (
    <div className="max-w-lg">
      {error && (
        <div role="alert" aria-live="assertive" className="mb-4 bg-destructive/10 border border-destructive/20 text-destructive px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <div className={`mb-5 border px-4 py-3 rounded-md text-sm ${label.kelas}`}>
        <div className="font-medium">{label.teks}</div>
        {status === 'WORKING' && nomor && (
          <div className="mt-1 text-xs">
            Nomor tertaut: <span className="font-mono">{nomor}</span>
            {sesi?.me?.pushName ? ` (${sesi.me.pushName})` : ''}
          </div>
        )}
      </div>

      {status === 'SCAN_QR_CODE' && (
        <div className="mb-5 bg-card border border-border rounded-lg p-6">
          <p className="text-sm text-foreground mb-1 font-medium">Tautkan perangkat</p>
          <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
            Di HP dengan nomor WhatsApp toko, buka <strong>WhatsApp → Setelan → Perangkat
            tertaut → Tautkan perangkat</strong>, lalu pindai kode di bawah. Kode berganti
            sendiri secara berkala — kalau gagal, tunggu sebentar dan coba lagi.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/bo/settings/whatsapp/qr?v=${qrNonce}`}
            alt="Kode QR untuk menautkan WhatsApp"
            width={264}
            height={264}
            className="border border-border rounded bg-white p-2"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {(status === 'STOPPED' || status === 'FAILED' || status === 'UNKNOWN') && (
          <button
            onClick={() => aksi('mulai')}
            disabled={sibuk !== null}
            className="px-4 py-2 text-sm rounded-md bg-primary text-primary-foreground disabled:opacity-50"
          >
            {sibuk === 'mulai' ? 'Menyalakan…' : 'Mulai sesi'}
          </button>
        )}
        <button
          onClick={() => aksi('nyalakan_ulang')}
          disabled={sibuk !== null}
          className="px-4 py-2 text-sm rounded-md border border-border disabled:opacity-50"
        >
          {sibuk === 'nyalakan_ulang' ? 'Menyalakan ulang…' : 'Nyalakan ulang'}
        </button>
        {status === 'WORKING' && (
          <button
            onClick={() => aksi('putuskan')}
            disabled={sibuk !== null}
            className="px-4 py-2 text-sm rounded-md border border-destructive/30 text-destructive disabled:opacity-50"
          >
            {sibuk === 'putuskan' ? 'Memutus…' : 'Putuskan tautan'}
          </button>
        )}
      </div>

      <p className="mt-5 text-xs text-muted-foreground leading-relaxed">
        Halaman ini mengatur nomor WhatsApp yang dipakai mengirim kode OTP ke pelanggan
        portal pesanan. Selama status bukan <strong>Tertaut &amp; siap</strong>, pelanggan
        tidak bisa masuk ke portal.
      </p>
    </div>
  )
}
