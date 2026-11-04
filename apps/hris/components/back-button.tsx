'use client';

import { usePathname, useRouter } from 'next/navigation';

/**
 * Tombol Kembali di bilah atas (permintaan owner 2026-11-04), tampil di semua halaman kecuali Beranda.
 * Kembali ke halaman sebelumnya; bila halaman dibuka langsung (tanpa riwayat), naik satu tingkat alamat.
 */
export function BackButton() {
  const pathname = usePathname();
  const router = useRouter();
  if (!pathname || pathname === '/') return null;

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    const parent = pathname.split('/').slice(0, -1).join('/');
    router.push(parent || '/');
  }

  return (
    <button
      type="button"
      onClick={goBack}
      className="flex items-center gap-1 rounded px-2 py-1 text-sm font-medium text-ink-muted hover:bg-black/5 hover:text-ink"
    >
      <span aria-hidden className="text-lg leading-none">←</span>
      Kembali
    </button>
  );
}
