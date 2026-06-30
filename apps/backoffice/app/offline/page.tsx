'use client'

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20h.01" />
          <path d="M8.5 16.4a5 5 0 0 1 7 0" />
          <path d="M5 12.9a10 10 0 0 1 14 0" />
          <path d="m2 8.8 20 .1" />
          <line x1="2" x2="22" y1="2" y2="22" />
        </svg>
      </div>
      <h1 className="text-lg font-semibold text-gray-900">Tidak ada koneksi</h1>
      <p className="max-w-xs text-sm text-gray-500">
        Dashboard membutuhkan koneksi internet untuk memuat data terbaru. Periksa
        jaringan Anda lalu coba lagi.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="mt-2 rounded-md bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700"
      >
        Coba lagi
      </button>
    </div>
  )
}
