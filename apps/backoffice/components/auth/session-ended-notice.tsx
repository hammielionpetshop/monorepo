'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { MonitorSmartphone } from 'lucide-react'

function Notice() {
  const reason = useSearchParams().get('reason')
  if (reason !== 'taken_over') return null

  return (
    <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
      <MonitorSmartphone className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <div>
        <p className="font-semibold">Akun Anda dipakai di perangkat lain</p>
        <p className="mt-0.5 text-xs opacity-90">
          Satu akun hanya bisa aktif di satu perangkat. Kalau bukan Anda yang melakukannya,
          segera ganti password Anda setelah masuk.
        </p>
      </div>
    </div>
  )
}

/**
 * Alasan kenapa seseorang mendarat di halaman login.
 *
 * Tanpa ini, sesi yang direbut perangkat lain terlihat sama persis dengan sesi yang habis
 * sendiri: orangnya tiba-tiba ada di halaman login tanpa tahu apa-apa — termasuk saat akunnya
 * benar-benar dipakai orang lain.
 *
 * `useSearchParams` wajib di dalam Suspense agar halaman login tetap bisa dirender statis.
 */
export default function SessionEndedNotice() {
  return (
    <Suspense fallback={null}>
      <Notice />
    </Suspense>
  )
}
