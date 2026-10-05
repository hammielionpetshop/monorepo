'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

type ImageLink = { url: string; fileName: string }

export default function DocumentImageExport<T>({
  data,
  label,
  renderImages,
  icon,
  buttonClassName = 'rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-muted/50 disabled:opacity-50',
}: {
  data: T
  label: string
  renderImages: (data: T) => Promise<{ blob: Blob; fileName: string }[]>
  icon?: ReactNode
  buttonClassName?: string
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<ImageLink[]>([])
  const generation = useRef(0)
  const dataKey = JSON.stringify(data)

  useEffect(() => {
    setImages([])
    setError(null)
    setSaving(false)
    return () => {
      generation.current += 1
    }
  }, [dataKey])

  useEffect(
    () => () => {
      images.forEach((image) => URL.revokeObjectURL(image.url))
    },
    [images]
  )

  async function saveImages() {
    if (saving) return
    const current = ++generation.current
    setSaving(true)
    setError(null)
    setImages([])
    const links: ImageLink[] = []
    try {
      const rendered = await renderImages(data)
      if (current !== generation.current) return
      rendered.forEach((image) => {
        links.push({
          url: URL.createObjectURL(image.blob),
          fileName: image.fileName,
        })
      })
      if (links.length === 1) {
        const anchor = document.createElement('a')
        anchor.href = links[0].url
        anchor.download = links[0].fileName
        document.body.appendChild(anchor)
        anchor.click()
        anchor.remove()
      }
      setImages(links)
    } catch {
      links.forEach((image) => URL.revokeObjectURL(image.url))
      if (current === generation.current) {
        setError(
          'Gambar gagal dibuat. Silakan coba lagi atau gunakan fitur cetak.'
        )
      }
    } finally {
      if (current === generation.current) setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={() => {
          void saveImages()
        }}
        disabled={saving}
        className={buttonClassName}
      >
        {icon}
        {saving ? 'Menyiapkan PNG…' : label}
      </button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      {images.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs" role="status">
          {images.length > 1 && <span>Unduh setiap halaman:</span>}
          {images.map((image, index) => (
            <a
              key={image.url}
              href={image.url}
              download={image.fileName}
              className="text-primary underline"
            >
              {images.length === 1 ? 'Unduh PNG' : `Halaman ${index + 1}`}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
