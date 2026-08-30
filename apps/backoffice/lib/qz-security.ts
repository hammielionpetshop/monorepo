// Konfigurasi tanda tangan QZ Tray — dipanggil sekali sebelum koneksi pertama.
//
// Tanpa ini QZ Tray memperlakukan tiap request sebagai anonim: muncul dialog
// "Action Required" yang untuk situs untrusted TIDAK bisa di-"Remember", jadi
// operator harus klik Allow di tiap sesi. Dengan sertifikat + endpoint signing,
// request ditandatangani sehingga QZ Tray mempercayainya:
//   - kalau sertifikatnya juga dipasang di QZ Tray (override.crt / Certificate
//     Manager) → tanpa dialog sama sekali;
//   - kalau belum → dialognya kini bisa di-"Remember this decision + Allow"
//     permanen (cukup sekali klik per PC).
//
// Private key tidak pernah sampai ke browser: string yang perlu ditandatangani
// dikirim ke /api/qz/sign, server yang menandatanganinya.
//
// Bila env QZ_PRIVATE_KEY / QZ_CERTIFICATE belum diisi, kedua endpoint membalas 501
// dan qz-tray.js otomatis jatuh ke mode anonim — persis seperti sebelum fitur ini ada.

type QzSecurity = {
  security: {
    setCertificatePromise: (
      fn: (resolve: (v: string) => void, reject: (e: unknown) => void) => void
    ) => void
    setSignatureAlgorithm: (algo: string) => void
    setSignaturePromise: (
      factory: (toSign: string) => (resolve: (v: string) => void, reject: (e: unknown) => void) => void
    ) => void
  }
}

let configured = false

export function configureQzSecurity(qzUnknown: unknown): void {
  if (configured || typeof window === 'undefined') return
  const qz = qzUnknown as QzSecurity
  if (!qz?.security?.setSignaturePromise) return
  configured = true

  // rejectOnFailure sengaja tidak diaktifkan: bila cert tak tersedia (env kosong / 501),
  // QZ resolve dengan cert kosong = mode anonim, bukan gagal cetak.
  qz.security.setCertificatePromise((resolve, reject) => {
    fetch('/api/qz/cert', { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('cert QZ tidak tersedia'))))
      .then(resolve)
      .catch(reject)
  })

  qz.security.setSignatureAlgorithm('SHA512')

  qz.security.setSignaturePromise((toSign) => (resolve, reject) => {
    fetch('/api/qz/sign', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: toSign }),
    })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error('gagal menandatangani request QZ'))))
      .then(resolve)
      .catch(reject)
  })
}
