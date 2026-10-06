export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { startShiftAutoCloseTimer } = await import('./lib/services/shift-auto-close')
  startShiftAutoCloseTimer()
}
