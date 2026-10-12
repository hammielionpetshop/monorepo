// Satu pintu cetak karcis grooming — pola yang sama dengan struk: printer Bluetooth bila
// terpasang, lalu QZ Tray (raw ESC/POS, tanpa dialog), dan jatuh ke cetak browser bila tak ada.

import { toast } from 'sonner'
import { isBluetoothPrinterConfigured, printEscposViaBluetooth } from '@/lib/bt-printer'
import { printThermalRawViaQz } from '@/lib/qz-thermal'
import { buildGroomingTicketsEscpos, type GroomingTicketData } from '@/lib/escpos-grooming-ticket'

export type { GroomingTicketData } from '@/lib/escpos-grooming-ticket'

export type GroomingTicketPrintRoute = 'bluetooth' | 'qz' | 'browser' | 'failed'

/**
 * `printViaBrowser` dipanggil hanya bila jalur raw gagal — berisi `window.print()` milik
 * pemanggil (komponen `GroomingTicketPrint` yang sudah ter-mount dengan karcis yang sama).
 */
export async function printGroomingTickets(
  tickets: GroomingTicketData[],
  printViaBrowser: () => void,
): Promise<GroomingTicketPrintRoute> {
  if (tickets.length === 0) return 'failed'
  const escpos = buildGroomingTicketsEscpos(tickets)

  if (isBluetoothPrinterConfigured()) {
    try {
      await printEscposViaBluetooth(escpos)
      return 'bluetooth'
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Gagal mencetak karcis ke printer Bluetooth')
      return 'failed'
    }
  }

  try {
    await printThermalRawViaQz(escpos)
    return 'qz'
  } catch {
    printViaBrowser()
    return 'browser'
  }
}
