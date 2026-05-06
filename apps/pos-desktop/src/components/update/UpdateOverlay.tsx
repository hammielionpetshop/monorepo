import { useEffect, useState } from "react"

type UpdateState = "checking" | "not-available" | "available" | "downloading" | "downloaded" | "error"

export function UpdateOverlay() {
  const [state, setState] = useState<UpdateState>("checking")
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(true)
  const [errorMsg, setErrorMsg] = useState("")

  useEffect(() => {
    if (import.meta.env.DEV) {
      setVisible(false)
      return
    }

    const updater = (window as any).ipcRenderer?.updater
    if (!updater) {
      setVisible(false)
      return
    }

    updater.onUpdateAvailable(() => setState("available"))

    updater.onUpdateNotAvailable(() => {
      setState("not-available")
      setTimeout(() => setVisible(false), 1500)
    })

    updater.onDownloadProgress((p: { percent: number }) => {
      setState("downloading")
      setProgress(Math.round(p.percent))
    })

    updater.onUpdateDownloaded(() => setState("downloaded"))

    updater.onUpdateError((msg: string) => {
      setErrorMsg(msg)
      setState("error")
      setTimeout(() => setVisible(false), 2500)
    })
  }, [])

  if (!visible) return null

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-6 w-80">
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl font-bold text-white tracking-wide">HAMMIELION</span>
          <span className="text-xs text-zinc-500 uppercase tracking-widest">Point of Sale</span>
        </div>

        {state === "checking" && (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm text-zinc-400">Memeriksa pembaruan...</p>
          </div>
        )}

        {state === "available" && (
          <div className="flex flex-col items-center gap-3">
            <Spinner />
            <p className="text-sm text-zinc-400">Pembaruan tersedia, menyiapkan unduhan...</p>
          </div>
        )}

        {state === "downloading" && (
          <div className="flex flex-col items-center gap-3 w-full">
            <p className="text-sm text-zinc-400">Mengunduh pembaruan... {progress}%</p>
            <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {state === "downloaded" && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div className="flex flex-col items-center gap-1">
              <span className="text-green-400 text-2xl">✓</span>
              <p className="text-sm text-zinc-300 font-medium">Pembaruan siap diinstal</p>
              <p className="text-xs text-zinc-500">Restart aplikasi untuk menerapkan pembaruan</p>
            </div>
            <div className="flex gap-3 w-full">
              <button
                onClick={() => (window as any).ipcRenderer?.updater?.installNow()}
                className="flex-1 bg-amber-500 hover:bg-amber-400 text-black text-sm font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Restart Sekarang
              </button>
              <button
                onClick={() => setVisible(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm py-2 px-4 rounded-lg transition-colors"
              >
                Nanti
              </button>
            </div>
          </div>
        )}

        {state === "not-available" && (
          <div className="flex flex-col items-center gap-2">
            <span className="text-green-400 text-xl">✓</span>
            <p className="text-sm text-zinc-400">Aplikasi sudah versi terbaru</p>
          </div>
        )}

        {state === "error" && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-sm text-red-400">Gagal memeriksa pembaruan</p>
            {errorMsg && <p className="text-xs text-zinc-500 text-center">{errorMsg}</p>}
            <p className="text-xs text-zinc-500">Melanjutkan...</p>
          </div>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg
      className="animate-spin h-6 w-6 text-amber-500"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  )
}
