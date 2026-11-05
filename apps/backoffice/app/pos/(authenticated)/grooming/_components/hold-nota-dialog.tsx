'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import CheckoutModal from '@/components/pos/checkout-modal'
import { newCheckoutRequestId } from '@/components/pos/checkout-request-id'
import type { BootstrapPaymentMethod } from '@/components/pos/pos-client'
import { useCartStore, hasServiceLines, type CartItem } from '@/components/pos/cart-store'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import type { ReceiptStoreInfo } from '@/lib/receipt-info'
import { buildHoldCartItems, cartTotal, type GroomingHold, type GroomingOrder, type ServiceOption } from './types'

interface Props {
  hold: GroomingHold
  /** true = "Buat Nota & Ambil": sesudah nota tersimpan, semua kucing tahanan ini ditandai diambil. */
  pickup: boolean
  services: ServiceOption[]
  ongkir: ServiceOption | null
  freeShippingValue: number | null
  paymentMethods: BootstrapPaymentMethod[]
  shiftId: number
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  storeInfo: ReceiptStoreInfo
  /** Dialog selesai (nota tersimpan atau dibatalkan) → muat ulang daftar. */
  onDone: (message: string | null) => void
}

/**
 * Buat Nota dari Grooming Ditahan: pilih cara bayar, lalu layar bayar kasir yang sama dipakai
 * apa adanya. Harga dihitung saat ini. Karcis TIDAK dicetak ulang — karcis TAHAN tetap berlaku.
 */
export default function HoldNotaDialog(props: Props) {
  const { hold } = props
  const router = useRouter()
  const [checkout, setCheckout] = useState<{ items: CartItem[]; requestId: string; debt: boolean } | null>(null)
  const [savedTransactionId, setSavedTransactionId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  // Enter di layar sukses bisa terpanggil dua kali — penandaan diambil cukup sekali.
  const finishedRef = useRef(false)

  function buildItems(): CartItem[] | null {
    try {
      return buildHoldCartItems(hold, props.services, props.ongkir, props.freeShippingValue)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Tahanan tidak bisa dibuatkan nota')
      return null
    }
  }

  function openCheckout(debt: boolean) {
    setError(null)
    if (debt && !props.paymentMethods.some((m) => m.type === 'DEBT')) {
      return setError('Metode Piutang belum tersedia. Hubungi Owner.')
    }
    const items = buildItems()
    if (!items) return
    setSavedTransactionId(null)
    setCheckout({ items, requestId: newCheckoutRequestId(), debt })
  }

  // Tambah belanja: baris tahanan pindah ke keranjang tab Kasir (membawa holdId). Tahanan tetap
  // DITAHAN sampai nota benar-benar tersimpan, jadi keranjang yang ditinggal tidak menghilangkannya.
  function addShopping() {
    setError(null)
    const items = buildItems()
    if (!items) return
    const cart = useCartStore.getState()
    if (cart.sourceIbt) return setError('Keranjang tab Kasir sedang memproses PO Internal. Selesaikan atau batalkan dulu.')
    if (hasServiceLines(cart.items) && !window.confirm('Keranjang tab Kasir sudah berisi grooming lain. Ganti dengan tahanan ini?')) return
    cart.addServiceLines(items, { id: hold.owner.id, name: hold.owner.name, tierType: hold.owner.tierType })
    router.push('/pos')
  }

  async function finish(transactionId: number | null) {
    if (!transactionId) {
      setCheckout(null)
      return
    }
    if (finishedRef.current) return
    finishedRef.current = true
    if (!props.pickup) {
      props.onDone('Nota tersimpan. Karcis TAHAN tetap berlaku — tidak perlu cetak ulang.')
      return
    }
    setFinishing(true)
    try {
      const res = await fetch(`/api/pos/grooming/orders?transactionId=${transactionId}`)
      const orders = res.ok ? ((await res.json()) as GroomingOrder[]) : []
      let failed = orders.length === 0
      for (const order of orders) {
        const r = await fetch(`/api/pos/grooming/orders/${order.id}/pickup`, { method: 'POST' })
        if (!r.ok) failed = true
      }
      props.onDone(failed
        ? 'Nota tersimpan, tetapi ada kucing yang belum tertandai diambil. Tekan Diambil di Sedang Dikerjakan.'
        : 'Nota tersimpan dan kucing ditandai diambil.')
    } catch {
      props.onDone('Nota tersimpan, tetapi penandaan diambil gagal. Tekan Diambil di Sedang Dikerjakan.')
    } finally {
      setFinishing(false)
    }
  }

  if (checkout) {
    return (
      <CheckoutModal
        items={checkout.items}
        grandTotal={cartTotal(checkout.items)}
        paymentMethods={props.paymentMethods}
        shiftId={props.shiftId}
        cashierId={props.cashierId}
        cashierName={props.cashierName}
        branchId={props.branchId}
        branchName={props.branchName}
        storeInfo={props.storeInfo}
        customerId={hold.owner.id}
        customerName={hold.owner.name}
        customerTier={hold.owner.tierType}
        clientRequestId={checkout.requestId}
        initialPaymentType={checkout.debt ? 'DEBT' : undefined}
        onSaved={(saved) => setSavedTransactionId(saved.transactionId)}
        onClose={() => { void finish(savedTransactionId) }}
        onSuccess={() => { void finish(savedTransactionId) }}
      />
    )
  }

  const pets = hold.lines.map((l) => l.pet.name).join(', ')
  const handover = hold.delivery ? 'Antar' : 'Ambil'

  return (
    <RequiredChoiceDialog
      title={props.pickup ? `Buat Nota & ${handover} — ${pets}` : `Buat Nota — ${pets}`}
      actions={[
        { label: 'Batal', onClick: () => props.onDone(null), variant: 'secondary', disabled: finishing },
      ]}
    >
      <p>
        {hold.owner.name} · karcis {hold.lines.map((l) => l.ticketNumber).join(', ')}
      </p>
      <ul className="mt-2 space-y-0.5 text-sm">
        {hold.lines.map((l) => (
          <li key={l.sequence}>
            {l.pet.name} — {l.serviceName} · {l.groomer.name}
            {l.discount ? <span className="text-xs text-muted-foreground"> · berdiskon</span> : null}
          </li>
        ))}
        {hold.delivery && (
          <li>Antar-jemput: {hold.delivery.courier.name}{hold.delivery.free ? ' (gratis ongkir)' : ''}</li>
        )}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Harga dihitung sekarang, mengikuti harga jasa dan golongan pelanggan hari ini.</p>
      <div className="mt-3 grid gap-2">
        <button
          type="button"
          disabled={finishing}
          onClick={() => openCheckout(false)}
          className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Lunas sekarang
        </button>
        {!props.pickup && (
          <button
            type="button"
            disabled={finishing}
            onClick={addShopping}
            className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
          >
            + Tambah belanja (satu nota)
          </button>
        )}
        <button
          type="button"
          disabled={finishing}
          onClick={() => openCheckout(true)}
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-500/20 disabled:opacity-50"
        >
          {props.pickup ? 'Belum bayar (piutang)' : 'Bayar saat ambil (piutang)'}
        </button>
      </div>
      {finishing && <p className="mt-2 text-sm text-muted-foreground">Menandai kucing diambil…</p>}
      {error && <p className="mt-3 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
    </RequiredChoiceDialog>
  )
}
