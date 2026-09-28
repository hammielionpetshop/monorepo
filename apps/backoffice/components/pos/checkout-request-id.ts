// crypto.randomUUID hanya ada di secure context (HTTPS/localhost) — kasir yang membuka lewat
// IP LAN http:// jatuh ke getRandomValues, yang tersedia di semua konteks.
export function newCheckoutRequestId(): string {
  const c = globalThis.crypto
  if (typeof c?.randomUUID === 'function') return c.randomUUID()
  const bytes = new Uint8Array(16)
  c.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}
