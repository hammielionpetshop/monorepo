'use client'

import { useEffect, useState } from 'react'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import {
  forgetBluetoothPrinter,
  getBluetoothPrinterName,
  isBluetoothPrinterReady,
  isBluetoothSupported,
  pairBluetoothPrinter,
  printEscposViaBluetooth,
  restoreBluetoothPrinter,
} from '@/lib/bt-printer'
import {
  ALIGN_CENTER,
  ALIGN_LEFT,
  BOLD_OFF,
  BOLD_ON,
  CODEPAGE_CP437,
  FEED_AND_CUT,
  INIT,
  LF,
  divider,
} from '@/lib/escpos-common'
import { RECEIPT_LAYOUT_LARGE } from '@/lib/escpos-receipt'

function buildTestPage(printerName: string): string {
  const { font, columns } = RECEIPT_LAYOUT_LARGE
  return [
    INIT,
    CODEPAGE_CP437,
    'M' + String.fromCharCode(font),
    ALIGN_CENTER,
    BOLD_ON,
    'TES CETAK BLUETOOTH' + LF,
    BOLD_OFF,
    printerName.replace(/[^\x20-\x7E]/g, '') + LF,
    ALIGN_LEFT,
    divider('-', columns) + LF,
    '1234567890'.repeat(4).padEnd(columns, '#').slice(0, columns) + LF,
    `Baris angka di atas harus pas satu baris (${columns} kolom).` + LF,
    divider('-', columns) + LF,
    FEED_AND_CUT,
  ].join('')
}

/**
 * Tombol pemasangan printer struk Bluetooth di header POS. Hanya tampil di perangkat
 * sentuh (HP/tablet) atau yang sudah pernah dipasangkan — PC kasir memakai QZ Tray dan
 * tidak perlu melihat tombol ini.
 */
export default function BluetoothPrinterButton() {
  const [visible, setVisible] = useState(false)
  const [printerName, setPrinterName] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isBluetoothSupported()) return
    const name = getBluetoothPrinterName()
    const touch = window.matchMedia('(pointer: coarse)').matches
    setVisible(touch || name !== null)
    setPrinterName(name)
    if (name) void restoreBluetoothPrinter().then(setReady)
  }, [])

  if (!visible) return null

  async function handlePair() {
    setBusy(true)
    try {
      const name = await pairBluetoothPrinter()
      setPrinterName(name)
      setReady(true)
      toast.success(`Printer ${name} tersambung`)
    } catch (error) {
      // Menutup dialog pilih perangkat juga melempar (NotFoundError) — bukan galat.
      if (!(error instanceof DOMException && error.name === 'NotFoundError')) {
        toast.error(error instanceof Error ? error.message : 'Gagal memasangkan printer')
      }
    } finally {
      setBusy(false)
      setReady(isBluetoothPrinterReady())
    }
  }

  async function handleTest() {
    if (!printerName) return
    setBusy(true)
    try {
      await printEscposViaBluetooth(buildTestPage(printerName))
      toast.success('Tes cetak terkirim')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tes cetak gagal')
    } finally {
      setBusy(false)
      setReady(isBluetoothPrinterReady())
    }
  }

  function handleForget() {
    forgetBluetoothPrinter()
    setPrinterName(null)
    setReady(false)
    toast.success('Printer Bluetooth dilepas — struk kembali lewat QZ Tray / cetak browser')
  }

  const status = !printerName ? 'none' : ready ? 'ready' : 'needs-tap'

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={printerName ? `Printer: ${printerName}` : 'Pasang printer Bluetooth'}
        className="relative flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-md px-3 py-1.5 hover:bg-accent transition-colors"
      >
        <Printer className="w-4 h-4" />
        <span
          className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full border-2 border-card ${
            status === 'ready' ? 'bg-green-500' : status === 'needs-tap' ? 'bg-amber-500' : 'bg-muted-foreground/40'
          }`}
        />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => !busy && setIsOpen(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10">
            <h3 className="text-lg font-bold text-foreground">Printer Struk Bluetooth</h3>
            <p className="text-sm text-muted-foreground mt-2">
              {status === 'none' && 'Belum ada printer. Nyalakan printer, lalu ketuk Pasangkan dan pilih printernya.'}
              {status === 'ready' && <>Tersambung ke <b className="text-foreground">{printerName}</b>. Struk akan langsung tercetak ke printer ini.</>}
              {status === 'needs-tap' && <>Printer <b className="text-foreground">{printerName}</b> perlu disambungkan ulang setelah halaman dimuat ulang. Ketuk Sambungkan.</>}
            </p>

            <div className="mt-6 flex flex-col gap-2">
              {status !== 'ready' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { void handlePair() }}
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
                >
                  {busy ? 'Menyambungkan...' : status === 'none' ? 'Pasangkan' : 'Sambungkan'}
                </button>
              )}
              {status === 'ready' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => { void handleTest() }}
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-xl disabled:opacity-50 transition-all cursor-pointer"
                >
                  {busy ? 'Mencetak...' : 'Tes Cetak'}
                </button>
              )}
              {status !== 'none' && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleForget}
                  className="min-h-[44px] px-4 py-2 text-sm font-semibold text-destructive border border-border rounded-xl hover:bg-destructive/10 disabled:opacity-50 transition-all cursor-pointer"
                >
                  Lepas Printer
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => setIsOpen(false)}
                className="min-h-[44px] px-4 py-2 text-sm font-semibold text-foreground bg-secondary hover:bg-secondary/80 border border-border rounded-xl disabled:opacity-50 transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
