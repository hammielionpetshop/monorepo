export async function register() {
  // Harus berbentuk `if (... === 'nodejs') { import }` — Next hanya membuang import ini dari
  // bundel edge lewat pola persis ini; `return` lebih awal membuat driver postgres ikut dibundel.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startShiftAutoCloseTimer } = await import('./lib/services/shift-auto-close')
    startShiftAutoCloseTimer()
  }
}
