const INTERNAL_PREFIX = '2' // Prefix GS1 in-store (20-29) untuk barcode internal toko

export function ean13CheckDigit(twelveDigits: string): number {
  if (!/^\d{12}$/.test(twelveDigits)) {
    throw new Error('Perhitungan check digit EAN-13 membutuhkan tepat 12 digit')
  }
  let sum = 0
  for (let i = 0; i < 12; i++) {
    const digit = twelveDigits.charCodeAt(i) - 48
    sum += i % 2 === 0 ? digit : digit * 3
  }
  return (10 - (sum % 10)) % 10
}

// Hasilkan barcode EAN-13 internal yang deterministik & unik dari ID produk.
// Format: "2" + productId (pad 11 digit) + check digit -> total 13 digit.
export function generateInternalEan13(productId: number): string {
  if (!Number.isInteger(productId) || productId <= 0 || productId > 99_999_999_999) {
    throw new Error('ID produk di luar rentang yang didukung untuk barcode internal')
  }
  const body = INTERNAL_PREFIX + String(productId).padStart(11, '0')
  return body + String(ean13CheckDigit(body))
}
