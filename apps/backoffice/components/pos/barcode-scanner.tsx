'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { X } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Kamera memerlukan koneksi aman (HTTPS). Buka lewat domain HTTPS atau tunnel (mis. ngrok).')
      return
    }

    const reader = new BrowserMultiFormatReader()
    let cancelled = false

    const video = videoRef.current!
    // Properti wajib agar autoplay diizinkan di browser mobile (iOS/Android)
    video.muted = true
    video.setAttribute('muted', 'true')
    video.setAttribute('playsinline', 'true')

    // Tunda start kamera satu tick. Di React Strict Mode (dev) efek dijalankan
    // dua kali; penundaan ini membuat timer mount pertama dibatalkan sebelum
    // sempat memicu getUserMedia, sehingga hanya satu stream yang aktif dan
    // preview tidak ikut ter-stop oleh cleanup mount pertama.
    const startTimer = setTimeout(() => {
      reader
        .decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          video,
          (result) => {
            if (cancelled || !result) return
            cancelled = true
            controlsRef.current?.stop()
            onScanRef.current(result.getText())
          }
        )
        .then((controls) => {
          controlsRef.current = controls
          if (cancelled) controls.stop()
        })
        .catch((e: unknown) => {
          if (cancelled) return
          const msg = e instanceof Error ? e.message : 'izin kamera ditolak'
          setError(`Tidak dapat mengakses kamera: ${msg}`)
        })
    }, 50)

    return () => {
      cancelled = true
      clearTimeout(startTimer)
      controlsRef.current?.stop()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="font-semibold">Arahkan kamera ke barcode</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup scanner"
          className="p-2 rounded-full hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {error ? (
          <p className="text-white text-center px-6 text-sm leading-relaxed">{error}</p>
        ) : (
          <>
            <video
              ref={videoRef}
              className="w-full h-full object-cover"
              autoPlay
              playsInline
              muted
            />
            {/* Bingkai bidik */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-64 h-40 border-2 border-white/80 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
            </div>
          </>
        )}
      </div>

      <p className="text-white/70 text-center text-xs px-6 py-4">
        Barcode akan terbaca otomatis saat fokus.
      </p>
    </div>
  )
}
