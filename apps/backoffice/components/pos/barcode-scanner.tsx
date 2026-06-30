'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser'
import { X } from 'lucide-react'

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

// `focusMode` & `zoom` belum ada di tipe DOM standar — perluasan manual.
type ZoomRange = { min: number; max: number; step: number }
type ExtendedCapabilities = MediaTrackCapabilities & {
  focusMode?: string[]
  zoom?: ZoomRange
}
type ExtendedConstraintSet = MediaTrackConstraintSet & {
  focusMode?: string
  zoom?: number
}

export default function BarcodeScanner({ onScan, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const controlsRef = useRef<IScannerControls | null>(null)
  const trackRef = useRef<MediaStreamTrack | null>(null)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  const [error, setError] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [zoomRange, setZoomRange] = useState<ZoomRange | null>(null)

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

    // Aktifkan continuous autofocus + siapkan kontrol zoom bila didukung perangkat.
    // Tanpa ini, barcode kecil sering blur karena kamera tak refokus otomatis.
    const tuneCamera = async () => {
      const stream = video.srcObject as MediaStream | null
      const track = stream?.getVideoTracks()[0]
      if (!track || typeof track.getCapabilities !== 'function') return
      trackRef.current = track
      const caps = track.getCapabilities() as ExtendedCapabilities

      if (caps.focusMode?.includes('continuous')) {
        try {
          await track.applyConstraints({
            advanced: [{ focusMode: 'continuous' } as ExtendedConstraintSet],
          })
        } catch {
          // abaikan — perangkat menolak constraint
        }
      }

      if (caps.zoom && caps.zoom.max > caps.zoom.min) {
        setZoomRange({ min: caps.zoom.min, max: caps.zoom.max, step: caps.zoom.step || 0.1 })
        const settings = track.getSettings() as MediaTrackSettings & { zoom?: number }
        setZoom(settings.zoom ?? caps.zoom.min)
      }
    }

    // Tunda start kamera satu tick. Di React Strict Mode (dev) efek dijalankan
    // dua kali; penundaan ini membuat timer mount pertama dibatalkan sebelum
    // sempat memicu getUserMedia, sehingga hanya satu stream yang aktif dan
    // preview tidak ikut ter-stop oleh cleanup mount pertama.
    const startTimer = setTimeout(() => {
      reader
        .decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              // Resolusi tinggi → barcode kecil punya lebih banyak piksel untuk didecode
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
          },
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
          if (cancelled) {
            controls.stop()
            return
          }
          void tuneCamera()
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
      trackRef.current = null
    }
  }, [])

  const handleZoom = (value: number) => {
    setZoom(value)
    const track = trackRef.current
    if (!track) return
    track
      .applyConstraints({ advanced: [{ zoom: value } as ExtendedConstraintSet] })
      .catch(() => {
        // abaikan — perangkat menolak nilai zoom
      })
  }

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

      {!error && zoomRange && (
        <div className="flex items-center gap-3 px-6 py-3">
          <span className="text-white/70 text-xs select-none">Zoom</span>
          <input
            type="range"
            min={zoomRange.min}
            max={zoomRange.max}
            step={zoomRange.step}
            value={zoom}
            onChange={(e) => handleZoom(Number(e.target.value))}
            aria-label="Atur zoom kamera"
            className="flex-1 accent-white"
          />
        </div>
      )}

      <p className="text-white/70 text-center text-xs px-6 py-4">
        Barcode akan terbaca otomatis saat fokus. Dekatkan atau perbesar zoom untuk barcode kecil.
      </p>
    </div>
  )
}
