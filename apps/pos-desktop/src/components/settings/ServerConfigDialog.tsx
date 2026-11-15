import { useState } from 'react'
import { Server, RotateCcw, Check, X } from 'lucide-react'
import { serverConfig } from '@/lib/server-config'

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function ServerConfigDialog({ isOpen, onClose }: Props) {
  const [url, setUrl] = useState(serverConfig.getUrl())
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  if (!isOpen) return null

  const validate = (value: string): string | null => {
    try {
      const parsed = new URL(value)
      if (!['http:', 'https:'].includes(parsed.protocol)) return 'Gunakan protokol http:// atau https://'
      return null
    } catch {
      return 'URL tidak valid'
    }
  }

  const handleSave = () => {
    const err = validate(url.trim())
    if (err) { setError(err); return }
    serverConfig.setUrl(url.trim())
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1000)
  }

  const handleReset = () => {
    const def = serverConfig.getDefault()
    setUrl(def)
    setError(null)
  }

  const handleChange = (v: string) => {
    setUrl(v)
    setError(null)
    setSaved(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-neutral-800 flex items-center justify-center">
              <Server className="w-4 h-4 text-neutral-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Konfigurasi Server</h2>
              <p className="text-xs text-neutral-500">URL backend API</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-neutral-500 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-2 mb-6">
          <label className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Server URL</label>
          <input
            type="url"
            value={url}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="http://192.168.1.100:3000/api"
            className="w-full bg-neutral-800/50 border border-white/5 rounded-xl py-3 px-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500/40 transition-all font-mono"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="flex-1 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2.5 rounded-xl transition-colors"
          >
            {saved ? <><Check className="w-4 h-4" /> Tersimpan</> : 'Simpan'}
          </button>
          <button
            onClick={handleReset}
            title="Reset ke default"
            className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white text-sm px-4 py-2.5 rounded-xl transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}
