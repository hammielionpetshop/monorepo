'use client'

import { useEffect, useState } from 'react'

const STORAGE_PREFIX = 'listFilters:'

/**
 * Semua field dari `storageKey` yang sama digabung ke satu blob JSON di sessionStorage,
 * supaya balik dari halaman detail semua filter halaman itu pulih bersamaan — bukan
 * sebagian pulih sebagian tidak, yang justru bikin nomor halaman `DataTable persistKey`
 * (dipulihkan terpisah, lihat `data-table-pagination.ts`) nyasar ke data yang salah.
 */
export function readPersistedFilterField<T>(storageKey: string, field: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + storageKey)
    if (!raw) return fallback
    const blob = JSON.parse(raw)
    return field in blob ? (blob[field] as T) : fallback
  } catch {
    return fallback
  }
}

export function writePersistedFilterField(storageKey: string, field: string, value: unknown): void {
  if (typeof window === 'undefined') return

  try {
    const raw = window.sessionStorage.getItem(STORAGE_PREFIX + storageKey)
    const blob = raw ? JSON.parse(raw) : {}
    blob[field] = value
    window.sessionStorage.setItem(STORAGE_PREFIX + storageKey, JSON.stringify(blob))
  } catch {
    // sessionStorage bisa gagal (mis. mode privat) - ini cuma pelengkap, aman diabaikan
  }
}

/**
 * Drop-in pengganti `useState` untuk filter list (search/tab/dropdown) yang perlu bertahan
 * saat komponennya remount — mis. balik dari halaman detail lewat `<Link>`/`router.push`.
 *
 * Tanpa ini, filter reset ke default saat remount padahal nomor halaman tabel (via
 * `DataTable persistKey`) tetap tersimpan — jadi nomor halaman lama diterapkan ke dataset
 * yang beda (unfiltered), yang dari sudut pandang user kelihatan seperti "balik ke halaman
 * pertama". Lihat riwayat kasus di `receivables-client.tsx`.
 *
 * Sengaja sessionStorage (bukan localStorage), sama seperti pageIndex di
 * `data-table-pagination.ts` — tab/sesi baru mulai dari default, bukan filter basi.
 *
 * @param storageKey kunci per HALAMAN (biasanya sama dengan `persistKey` DataTable-nya).
 * @param field nama field filter ini di dalam halaman itu (mis. "search", "statusFilter").
 */
export function usePersistedFilterState<T>(storageKey: string, field: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => readPersistedFilterField(storageKey, field, initialValue))

  useEffect(() => {
    writePersistedFilterField(storageKey, field, value)
  }, [storageKey, field, value])

  return [value, setValue] as const
}
