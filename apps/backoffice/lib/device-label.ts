/**
 * Ringkasan perangkat seadanya, hanya untuk ditampilkan ke pemilik akun ("terakhir dipakai di
 * Chrome / Android"). Sengaja kasar — ini bukan sidik jari perangkat dan tidak dipakai untuk
 * keputusan keamanan apa pun.
 *
 * Berkas terpisah dari `services/user-session.ts` supaya tetap murni: modul itu mengimpor
 * lapisan database, dan fungsi sekecil ini tidak perlu ikut menyeretnya.
 */
export function describeDevice(userAgent: string | null): string | null {
  if (!userAgent) return null;

  const os =
    /Android/i.test(userAgent) ? 'Android'
    : /iPhone|iPad|iPod/i.test(userAgent) ? 'iOS'
    : /Windows/i.test(userAgent) ? 'Windows'
    : /Mac OS X/i.test(userAgent) ? 'macOS'
    : /Linux/i.test(userAgent) ? 'Linux'
    : null;

  // Urutannya penting: Edge & Opera menyebut "Chrome" di UA-nya, dan Chrome menyebut "Safari".
  const browser =
    /Edg\//i.test(userAgent) ? 'Edge'
    : /OPR\//i.test(userAgent) ? 'Opera'
    : /Chrome\//i.test(userAgent) ? 'Chrome'
    : /Firefox\//i.test(userAgent) ? 'Firefox'
    : /Safari\//i.test(userAgent) ? 'Safari'
    : null;

  const label = [browser, os].filter(Boolean).join(' / ');
  return label ? label.slice(0, 200) : null;
}
