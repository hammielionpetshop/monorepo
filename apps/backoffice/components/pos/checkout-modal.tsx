'use client'

import { useState, useRef, useEffect } from 'react'
import Big from 'big.js'
import { CartItem, formatRupiah } from './cart-store'
import { checkoutTotals, checkoutGrandTotal, toCheckoutItems } from './checkout-payload'
import { usePromoCart } from './promo-cart'
import { usePromoStore } from './promo-store'

import type { BootstrapPaymentMethod } from './pos-client'
import type { ReceiptStoreInfo } from '@/lib/receipt-info'
import ReceiptPrint from './receipt-print'
import BulkSaleDeliveryNotePrint from '@/app/(dashboard)/transactions/bulk-sale/_components/bulk-sale-delivery-note-print'
import type { DeliveryNoteData } from '@/lib/delivery-note-layout'
import { printDeliveryNoteThermal } from '@/lib/print-delivery-note-thermal'
import { printReceipt } from '@/lib/print-receipt'
import { useConnection } from '@/components/connection/connection-provider'
import { useShortcutLock } from './shortcut-lock'
import { NewBadge } from '@/components/ui/new-badge'
import { applyFreeShipping, isOngkirItem } from '@/lib/ongkir'

interface CheckoutModalProps {
  items: CartItem[]
  grandTotal: string
  paymentMethods: BootstrapPaymentMethod[]
  shiftId: number
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  storeInfo: ReceiptStoreInfo
  customerId: number | null
  customerName?: string | null
  // Golongan pelanggan nota (customers.default_tier_type); null = tanpa pelanggan (Retail).
  // Dipakai menghitung promo di layar — hanya golongan Retail yang kena promo.
  customerTier?: string | null
  // Diisi saat keranjang berasal dari "Proses" PO Internal — dikirim ke server agar transaksi
  // tertaut ke IBT (saleType BULK + auto-approve, jalur sama dgn Bulk Sale backoffice).
  sourceIbtId?: number | null
  // Kunci idempotensi — sama selama isi keranjang sama, lihat pos-client.
  clientRequestId: string
  // Tab Grooming "Bayar saat ambil": layar bayar terbuka dengan metode piutang sudah terpilih.
  initialPaymentType?: string
  // Dipanggil sekali begitu nota tersimpan (tab Grooming memakainya untuk mencetak karcis).
  onSaved?: (saved: { transactionId: number; receiptNumber: string }) => void
  onClose: () => void
  onSuccess: () => void
}

interface TransactionResult {
  receiptNumber: string
  transactionId: number
  replayed: boolean
}

interface SplitLine {
  key: number
  paymentMethodId: number
  amount: string
}

function parseIntBig(value: string): Big {
  try {
    const intStr = value.replace(/[^0-9]/g, '')
    return intStr ? new Big(intStr) : new Big(0)
  } catch {
    return new Big(0)
  }
}

export default function CheckoutModal({
  items: cartItems,
  paymentMethods,
  shiftId,
  cashierId,
  cashierName,
  branchId,
  branchName,
  storeInfo,
  customerId,
  customerName,
  customerTier = null,
  sourceIbtId,
  clientRequestId,
  initialPaymentType,
  onSaved,
  onClose,
  onSuccess,
}: CheckoutModalProps) {
  // Modal ini butuh keyboard — matikan shortcut latar POS selama terbuka.
  useShortcutLock()

  // Pastikan promo cabang termuat. Layar Kasir utama sudah memuatnya saat dibuka; tab Grooming
  // ("Bayar saat ambil") membuka modal ini tanpa melewati layar Kasir, jadi muat di sini juga.
  useEffect(() => {
    if (!usePromoStore.getState().loaded) void usePromoStore.getState().load()
  }, [])

  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<number | null>(
    (initialPaymentType ? paymentMethods.find((m) => m.type === initialPaymentType)?.id : undefined) ?? paymentMethods[0]?.id ?? null
  )
  const [amountPaid, setAmountPaid] = useState('')
  const [dueAt, setDueAt] = useState('')
  const [splitMode, setSplitMode] = useState(false)
  const [splitLines, setSplitLines] = useState<SplitLine[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<TransactionResult | null>(null)
  // Saat true, state sukses merender Surat Jalan (bukan struk) sebelum window.print().
  const [sjMode, setSjMode] = useState(false)
  // Sama dengan Bulk Sale: default tanpa harga (SURAT JALAN); dicentang → NOTA PENJUALAN.
  const [sjWithPrice, setSjWithPrice] = useState(false)
  // PO Internal dari POS berhenti di "Disetujui"; kasir mengirimnya dari sini tanpa membuka
  // tab Menunggu Pengiriman (kanban #50). Tetap manual supaya masih ada jeda untuk batal.
  const [shipState, setShipState] = useState<'idle' | 'busy' | 'done'>('idle')
  const [shipError, setShipError] = useState('')

  const { isOnline, status: connectionStatus, reportFailure } = useConnection()

  // Ongkir dari daftar produk (antar barang) wajib memilih pengantar internal — bonus 50% ongkir
  // (spec jasa grooming butir 28–31). Baris ongkir delivery dari tab Grooming sudah membawa datanya.
  const plainOngkirLines = cartItems.filter((i) => isOngkirItem(i) && !i.delivery)
  const needsCourier = plainOngkirLines.length > 0
  const courierProblem = !needsCourier
    ? null
    : plainOngkirLines.length > 1
      ? 'Ongkos kirim hanya boleh satu baris per nota. Hapus salah satu, lalu gabungkan qty-nya.'
      : cartItems.some((i) => i.grooming || i.delivery)
        ? 'Nota ini berisi grooming: ongkos kirimnya diatur dari tab Grooming (pilihan Delivery). Hapus baris ongkir ini dari keranjang.'
        : null
  const [couriers, setCouriers] = useState<{ id: number; name: string }[] | null>(null)
  const [courierId, setCourierId] = useState('')
  // Nilai gratis ongkir (ongkir standar dari Pengaturan) — null = belum termuat / gagal.
  const [freeShippingValue, setFreeShippingValue] = useState<number | null>(null)
  useEffect(() => {
    if (!needsCourier || couriers) return
    let cancelled = false
    fetch('/api/bo/groomers?active=1&role=courier')
      .then((res) => (res.ok ? res.json() : []))
      .then((list: { id: number; name: string }[]) => {
        if (!cancelled) setCouriers(list.map((c) => ({ id: c.id, name: c.name })))
      })
      .catch(() => {
        if (!cancelled) setCouriers([])
      })
    fetch('/api/pos/free-shipping')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { value?: number } | null) => {
        if (!cancelled && data?.value) setFreeShippingValue(data.value)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [needsCourier, couriers])
  const courierPicked = !needsCourier || (courierId !== '' && courierProblem === null)
  // Gratis ongkir (kasir yang menentukan): baris ongkir tetap tercatat nilainya tetapi dipotong
  // penuh — pelanggan tidak membayar, pengantar tidak dapat bonus. Tidak dicentang = tertagih.
  const [freeShipping, setFreeShipping] = useState(false)
  const ongkirLine = needsCourier && courierProblem === null ? plainOngkirLines[0] : null
  // Gratis ongkir lewat mesin ongkir: qty = nilai standar ÷ harga, dipotong penuh.
  let freeShippingError: string | null = null
  let freeLine: CartItem | null = null
  if (ongkirLine && freeShipping) {
    if (freeShippingValue == null) freeShippingError = 'Nilai gratis ongkir belum termuat — coba tutup lalu buka lagi layar bayar.'
    else {
      try {
        freeLine = applyFreeShipping(ongkirLine, freeShippingValue)
      } catch (e) {
        freeShippingError = e instanceof Error ? e.message : 'Gratis ongkir tidak bisa dipakai'
      }
    }
  }
  // Baris yang benar-benar disimpan & dicetak: baris ongkir membawa pengantar (dan potongan bila gratis).
  const items: CartItem[] = ongkirLine && courierId
    ? cartItems.map((i) => i === ongkirLine
      ? {
          ...(freeLine ?? i),
          delivery: { courierId: Number(courierId), ...(freeLine ? { freeShipping: true } : {}) },
        }
      : i)
    : cartItems
  // Promo otomatis (P2d): dihitung di layar dengan mesin promo + jam server, lalu dikirim per baris.
  // Server tetap menghitung ulang & menjadi hakimnya; bila beda, nota ditolak dan layar memuat
  // ulang promo (lihat handleSubmit). PO Internal di luar jangkauan promo.
  const outOfScope = sourceIbtId != null
  // P4d: mesin promo bisa menambah baris hadiah gratis (beli X gratis Y). Baris hadiah bukan barang
  // yang dibeli — ia ikut dikirim & disimpan (bertanda promo.gift, tagihan 0) tetapi tidak menambah
  // total. Server menghitung ulang hadiah dari baris berbayar lalu mencocokkannya.
  const { awards: promoAwards, giftLines } = usePromoCart(items, customerTier, outOfScope)
  // Baris yang dikirim & dicatat server = barang yang dibeli + baris hadiah gratis. Potongan promo
  // (`awards`) hanya untuk barang yang dibeli; baris hadiah tidak punya award baris.
  const payloadItems = giftLines.length > 0 ? [...items, ...giftLines] : items
  const payloadAwards = giftLines.length > 0 ? [...promoAwards, ...giftLines.map(() => null)] : promoAwards
  // Total sudah termasuk potongan promo; baris ongkir gratis sudah bernilai 0 di `items`; baris
  // hadiah gratis bernilai 0 juga → tidak mengubah total.
  const grandTotal = String(checkoutGrandTotal(items, promoAwards))
  // Struk (P2e): nama promo + potongannya per baris, menggantikan "Diskon" di baris berpromo.
  const receiptPromos = promoAwards.map((award) => (award ? { name: award.promoName, amount: award.amount } : null))

  const submittingRef = useRef(false)
  const splitKeyRef = useRef(0)
  const amountInputRef = useRef<HTMLInputElement>(null)

  // Auto-fokus input nominal saat modal buka
  useEffect(() => {
    const timer = setTimeout(() => amountInputRef.current?.focus(), 80)
    return () => clearTimeout(timer)
  }, [])

  // Enter di state sukses → transaksi baru
  useEffect(() => {
    if (!result) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Enter') { e.preventDefault(); onSuccess() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [result, onSuccess])

  // Diskon hanya per barang (dipasang di keranjang / daftar Grooming) dan sudah termasuk di
  // total — layar bayar sengaja TIDAK punya diskon total nota lagi, supaya satu nota tidak
  // mungkin didiskon dua kali (keputusan owner 2026-10-12).
  const netTotalBig = new Big(grandTotal)
  const netTotalNum = netTotalBig.toNumber()
  // Diskon manual hanya pada baris yang tidak kena promo (promo menang pada baris yang sama).
  const lineDiscountBig = items.reduce(
    (acc, it, i) => (it.manualDiscount && !promoAwards[i] ? acc.plus(it.discountAmount) : acc),
    new Big(0),
  )
  const promoDiscountBig = promoAwards.reduce((acc, a) => (a ? acc.plus(a.amount) : acc), new Big(0))
  const hasDiscount = lineDiscountBig.gt(0)
  const hasPromo = promoDiscountBig.gt(0)

  const methodById = new Map(paymentMethods.map((m) => [m.id, m]))

  // ── Single payment ───────────────────────────────────────────────
  const amountPaidBig = parseIntBig(amountPaid)
  const selectedMethod = paymentMethods.find((m) => m.id === selectedPaymentMethodId)
  const isCash = selectedMethod?.type === 'CASH'
  const isDebt = selectedMethod?.type === 'DEBT'

  // ── Split payment ────────────────────────────────────────────────
  const splitPaidBig = splitLines.reduce(
    (acc, l) => acc.plus(parseIntBig(l.amount)),
    new Big(0)
  )
  const splitRemainingBig = netTotalBig.minus(splitPaidBig)
  const splitHasDebt = splitLines.some(
    (l) => methodById.get(l.paymentMethodId)?.type === 'DEBT'
  )
  const splitDebtBig = splitLines.reduce(
    (acc, l) =>
      methodById.get(l.paymentMethodId)?.type === 'DEBT'
        ? acc.plus(parseIntBig(l.amount))
        : acc,
    new Big(0)
  )
  const splitChangeBig =
    !splitHasDebt && splitPaidBig.gt(netTotalBig)
      ? splitPaidBig.minus(netTotalBig)
      : new Big(0)
  const splitNeedsCustomer = splitHasDebt && customerId === null
  const splitValid =
    splitLines.length > 0 &&
    splitLines.some((l) => parseIntBig(l.amount).gt(0)) &&
    splitPaidBig.gte(netTotalBig) &&
    !splitNeedsCustomer

  // ── Mode aktif ───────────────────────────────────────────────────
  const kembalian = splitMode
    ? splitChangeBig.gt(0)
      ? splitChangeBig.toString()
      : null
    : !isDebt && amountPaidBig.gte(netTotalBig)
      ? amountPaidBig.minus(netTotalBig).toString()
      : null

  // Metode non-tunai (bukan CASH, bukan DEBT — mis. QRIS/transfer/e-wallet) dibayar pas,
  // tidak ada kembalian untuk dihitung manual → isi otomatis nominal bayar dgn total tagihan.
  useEffect(() => {
    if (!isCash && !isDebt) {
      setAmountPaid(String(netTotalNum))
    }
  }, [selectedPaymentMethodId, isCash, isDebt, netTotalNum])

  const isAmountValid = amountPaidBig.gte(netTotalBig)
  const courierReady = courierPicked && freeShippingError === null
  const canSubmit = loading || !isOnline || !courierReady
    ? false
    : splitMode
      ? splitValid
      : isDebt
        ? selectedPaymentMethodId !== null && customerId !== null
        : selectedPaymentMethodId !== null && isAmountValid

  // Hotkey: Esc tutup, Alt+1..9 pilih metode, F1 uang pas, F2/F3/F4 pecahan tunai
  useEffect(() => {
    if (result) return
    const handler = (e: KeyboardEvent) => {
      if (loading) return

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }

      // Alt+1..9 → pilih metode pembayaran (mode tunggal)
      if (e.altKey && !splitMode && /^[1-9]$/.test(e.key)) {
        const pm = paymentMethods[Number(e.key) - 1]
        if (pm) {
          e.preventDefault()
          setSelectedPaymentMethodId(pm.id)
        }
        return
      }

      // F1-F4 → nominal cepat (mode tunggal, non-hutang)
      if (!splitMode && !isDebt) {
        if (e.key === 'F1') {
          e.preventDefault()
          setAmountPaid(String(netTotalNum))
          return
        }
        if (isCash) {
          const denom = { F2: 20000, F3: 50000, F4: 100000 }[e.key]
          if (denom) {
            e.preventDefault()
            setAmountPaid(String(Math.ceil(netTotalNum / denom) * denom))
          }
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [result, loading, splitMode, isDebt, isCash, netTotalNum, paymentMethods, onClose])

  function fillAmount(value: number) {
    setAmountPaid(String(value))
  }

  function fillDenomination(denom: number) {
    const rounded = Math.ceil(netTotalNum / denom) * denom
    setAmountPaid(String(rounded))
  }

  function enterSplitMode() {
    setError('')
    setSplitMode(true)
    if (splitLines.length === 0) {
      // Baris pertama: metode terpilih saat ini, prefill dengan total
      const firstId = selectedPaymentMethodId ?? paymentMethods[0]?.id
      if (firstId != null) {
        splitKeyRef.current += 1
        setSplitLines([
          { key: splitKeyRef.current, paymentMethodId: firstId, amount: String(netTotalNum) },
        ])
      }
    }
  }

  function exitSplitMode() {
    setError('')
    setSplitMode(false)
  }

  function addSplitLine() {
    const used = new Set(splitLines.map((l) => l.paymentMethodId))
    const nextMethod =
      paymentMethods.find((m) => !used.has(m.id)) ?? paymentMethods[0]
    if (!nextMethod) return
    splitKeyRef.current += 1
    const remaining = splitRemainingBig.gt(0) ? splitRemainingBig.toString() : ''
    setSplitLines((prev) => [
      ...prev,
      { key: splitKeyRef.current, paymentMethodId: nextMethod.id, amount: remaining },
    ])
  }

  function updateSplitLine(key: number, patch: Partial<SplitLine>) {
    setSplitLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l))
    )
  }

  function removeSplitLine(key: number) {
    setSplitLines((prev) => prev.filter((l) => l.key !== key))
  }

  function fillSplitRemaining(key: number) {
    if (splitRemainingBig.lte(0)) return
    const line = splitLines.find((l) => l.key === key)
    const current = line ? parseIntBig(line.amount) : new Big(0)
    updateSplitLine(key, { amount: current.plus(splitRemainingBig).toString() })
  }

  // Rincian pembayaran untuk struk & ringkasan sukses
  const receiptPayments = splitMode
    ? splitLines
        .filter((l) => parseIntBig(l.amount).gt(0))
        .map((l) => ({
          name: methodById.get(l.paymentMethodId)?.name ?? '-',
          amount: parseIntBig(l.amount).toString(),
        }))
    : [
        {
          name: selectedMethod?.name ?? '-',
          amount: (isDebt ? netTotalBig : amountPaidBig).toString(),
        },
      ]
  const totalPaidBig = splitMode ? splitPaidBig : isDebt ? netTotalBig : amountPaidBig

  async function handleSubmit() {
    if (!canSubmit || submittingRef.current) return
    submittingRef.current = true
    setLoading(true)
    setError('')

    let payments: { paymentMethodId: number; amount: number; referenceNumber: null }[]
    let payloadAmountPaid: number
    let payloadChange: number
    let payloadDueAt: string | null

    if (splitMode) {
      payments = splitLines
        .filter((l) => parseIntBig(l.amount).gt(0))
        .map((l) => ({
          paymentMethodId: l.paymentMethodId,
          amount: parseIntBig(l.amount).toNumber(),
          referenceNumber: null,
        }))
      payloadAmountPaid = splitPaidBig.toNumber()
      payloadChange = splitChangeBig.toNumber()
      payloadDueAt = splitHasDebt ? dueAt || null : null
    } else {
      payments = [
        {
          paymentMethodId: selectedPaymentMethodId!,
          amount: isDebt ? netTotalBig.toNumber() : amountPaidBig.toNumber(),
          referenceNumber: null,
        },
      ]
      payloadAmountPaid = isDebt ? netTotalBig.toNumber() : amountPaidBig.toNumber()
      payloadChange = isDebt ? 0 : kembalian ? new Big(kembalian).toNumber() : 0
      payloadDueAt = isDebt ? dueAt || null : null
    }

    const payload = {
      branchId,
      shiftId,
      cashierId,
      customerId: customerId,
      items: toCheckoutItems(payloadItems, payloadAwards),
      payments,
      totals: checkoutTotals(payloadItems, netTotalNum),
      amountPaid: payloadAmountPaid,
      change: payloadChange,
      dueAt: payloadDueAt,
      sourceIbtId: sourceIbtId ?? null,
      clientRequestId,
    }

    try {
      const res = await fetch('/api/pos/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      let data: { success?: boolean; replayed?: boolean; transaction?: { id: number; trxNumber?: string }; error?: string; code?: string } = {}
      const ct = res.headers.get('content-type')
      if (ct && ct.includes('application/json')) {
        data = await res.json()
      }

      if (!res.ok) {
        // Promo berubah / tidak cocok: muat ulang promo cabang lalu minta kasir memeriksa & bayar
        // lagi. Hitungan keranjang & total otomatis diperbarui karena promo di-store dibaca ulang.
        if (data.code === 'PROMO_CHANGED' || data.code === 'PROMO_INVALID') {
          void usePromoStore.getState().load()
        }
        setError(data.error || 'Transaksi gagal. Silakan coba lagi.')
        setLoading(false)
        submittingRef.current = false
        return
      }

      const saved = {
        receiptNumber: data.transaction?.trxNumber ?? `TRX-${data.transaction?.id ?? Date.now()}`,
        transactionId: data.transaction?.id ?? 0,
      }
      setResult({ ...saved, replayed: data.replayed === true })
      onSaved?.(saved)
      // Nota berpromo berkuota mengurangi jatah cabang. Muat ulang supaya nota berikutnya di kasir
      // ini memakai sisa jatah terbaru — tanpa ini nota selanjutnya bisa ditolak PROMO_CHANGED.
      void usePromoStore.getState().load()
    } catch {
      // Verifikasi ulang status koneksi agar banner global ikut menyala,
      // tidak hanya pesan lokal di dalam modal ini.
      reportFailure()
      // Request bisa sudah tersimpan walau responsnya hilang di jalan — jangan klaim "tidak
      // tersimpan". Bayar ulang aman karena clientRequestId sama: server mengembalikan yang lama.
      setError('Koneksi terputus — status transaksi belum pasti. Setelah koneksi pulih, tekan Bayar lagi: sistem tidak akan mencatatnya dua kali.')
    } finally {
      setLoading(false)
      submittingRef.current = false
    }
  }


  function buildSjData(receiptNumber: string): DeliveryNoteData {
    return {
      transactionNumber: receiptNumber,
      transactionDate: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }),
      branchName,
      customerName: customerName ?? 'Cabang tujuan',
      staffName: cashierName,
      items: items.map((it, i) => ({
        id: `${it.productId}-${it.uomId}-${i}`,
        productCode: '',
        productName: it.productName,
        uomCode: it.uomCode,
        qty: it.qty,
        unitPrice: Number(it.unitPrice),
        subtotal: Number(it.subtotal),
      })),
      withPrice: sjWithPrice,
      grandTotal: netTotalBig.toNumber(),
    }
  }

  // Surat Jalan PO Internal: kasir hanya punya printer termal 80mm. Coba QZ Tray (raw
  // ESC/POS, tanpa dialog); bila gagal render komponen SJ versi termal (menggantikan
  // struk di DOM) lalu cetak via dialog browser.
  async function handleKirimSekarang() {
    if (sourceIbtId == null) return
    if (!confirm('Kirim PO Internal ini sekarang? Statusnya berubah menjadi "Dalam Pengiriman" dan tidak bisa dibatalkan dari kasir.')) return
    setShipState('busy')
    setShipError('')
    try {
      const res = await fetch(`/api/pos/internal-po/${sourceIbtId}/ship`, { method: 'PATCH' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setShipError((d as { error?: string }).error ?? 'Gagal mengirim PO Internal')
        setShipState('idle')
        return
      }
      setShipState('done')
    } catch {
      setShipError('Terjadi kesalahan jaringan. Coba lagi.')
      setShipState('idle')
    }
  }

  async function handleCetakSuratJalan() {
    if (!result) return
    await printDeliveryNoteThermal(buildSjData(result.receiptNumber), async () => {
      setSjMode(true)
      await new Promise((r) => setTimeout(r, 60))
      window.print()
      setSjMode(false)
    })
  }

  // Cetak lewat QZ Tray (raw ESC/POS, tanpa dialog); jatuh ke cetak browser bila QZ tak ada.
  async function handleCetakStruk() {
    if (!result) return
    await printReceipt(
      {
        receiptNumber: result.receiptNumber,
        items,
        promos: receiptPromos,
        grandTotal: netTotalBig.toString(),
        customerName: customerName ?? undefined,
        amountPaid: totalPaidBig.toString(),
        kembalian: kembalian ?? '0',
        paymentMethodName: selectedMethod?.name ?? '-',
        payments: receiptPayments,
        storeName: storeInfo.storeName,
        storeAddress: storeInfo.storeAddress,
        storePhone: storeInfo.storePhone,
        transactionDate: new Date(),
        cashierName,
      },
      () => window.print()
    )
  }

  // Success state
  if (result) {
    return (
      <>
        {sjMode ? (
          <BulkSaleDeliveryNotePrint paper="thermal" {...buildSjData(result.receiptNumber)} />
        ) : (
          <ReceiptPrint
            receiptNumber={result.receiptNumber}
            items={items}
            promos={receiptPromos}
            grandTotal={netTotalBig.toString()}
            customerName={customerName ?? undefined}
            amountPaid={totalPaidBig.toString()}
            kembalian={kembalian ?? '0'}
            paymentMethodName={selectedMethod?.name ?? '-'}
            payments={receiptPayments}
            branchName={branchName}
            storeName={storeInfo.storeName}
            storeAddress={storeInfo.storeAddress}
            storePhone={storeInfo.storePhone}
            transactionDate={new Date()}
            cashierName={cashierName}
          />
        )}

        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 print:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-foreground">Transaksi Berhasil!</h3>
              <p className="text-sm text-muted-foreground mt-2">No. Struk:</p>
              <p className="text-base font-mono font-bold text-foreground">{result.receiptNumber}</p>
              {result.replayed && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
                  Transaksi ini ternyata sudah tersimpan saat percobaan sebelumnya — tidak dicatat dua kali.
                </p>
              )}
            </div>

            <div className="bg-muted/40 rounded-xl p-4 mb-6 space-y-2 text-sm">
              {hasPromo && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Promo</span>
                  <span className="font-bold text-green-600">-{formatRupiah(promoDiscountBig.toString())}</span>
                </div>
              )}
              {hasDiscount && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Diskon barang</span>
                  <span className="font-bold text-orange-600">-{formatRupiah(lineDiscountBig.toString())}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total</span>
                <span className="font-bold">{formatRupiah(netTotalBig.toString())}</span>
              </div>
              {receiptPayments.map((p, idx) => (
                <div key={idx} className="flex justify-between">
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="font-bold">{formatRupiah(p.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">Kembalian</span>
                <span className="font-bold text-green-600">{formatRupiah(kembalian ?? '0')}</span>
              </div>
            </div>

            {sourceIbtId != null && (
              <>
                <label className="mb-2 flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={sjWithPrice}
                    onChange={(e) => setSjWithPrice(e.target.checked)}
                    className="h-4 w-4"
                  />
                  Sertakan harga
                </label>
                <button
                  type="button"
                  onClick={() => { void handleCetakSuratJalan() }}
                  className="w-full min-h-[48px] mb-3 border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] transition-all"
                >
                  {sjWithPrice ? '📄 Cetak Nota Penjualan' : '📄 Cetak Surat Jalan'}
                </button>
                {shipState === 'done' ? (
                  <p className="mb-3 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2.5 text-sm font-medium text-green-700 dark:text-green-400">
                    ✓ PO Internal dikirim — sudah muncul di Transfer Masuk cabang tujuan.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => { void handleKirimSekarang() }}
                      disabled={shipState === 'busy'}
                      className="w-full min-h-[48px] mb-1 rounded-xl bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 active:scale-[0.98] transition-all"
                    >
                      {shipState === 'busy' ? 'Mengirim...' : '🚚 Kirim Sekarang'}
                    </button>
                    <p className="mb-3 text-xs text-muted-foreground">
                      {shipError || 'Belum dikirim? Bisa juga nanti dari PO Internal → Menunggu Pengiriman.'}
                    </p>
                  </>
                )}
              </>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => { void handleCetakStruk() }}
                className="flex-1 min-h-[52px] border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] transition-all"
              >
                🖨️ Cetak Struk
              </button>
              <button
                type="button"
                onClick={onSuccess}
                className="flex-1 min-h-[52px] bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:opacity-90 active:scale-[0.98] transition-all"
              >
                Transaksi Baru
              </button>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Checkout form state
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl z-10 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-foreground">Pembayaran</h3>
          {!loading && (
            <button
              type="button"
              onClick={onClose}
              title="Tutup (Esc)"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              ✕
            </button>
          )}
        </div>

        {/* Summary */}
        <div className="bg-muted/40 rounded-xl px-4 py-3 mb-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">
              {items.length} item
              {hasDiscount && (
                <span className="text-orange-600 font-semibold">
                  {' '}· sudah dipotong diskon barang {formatRupiah(lineDiscountBig.toString())}
                </span>
              )}
            </span>
            <span className="text-2xl font-extrabold text-foreground tabular-nums">
              {formatRupiah(netTotalBig.toString())}
            </span>
          </div>
        </div>

        {needsCourier && (
          <div className="mb-3 rounded-xl border border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-950/30 px-3 py-2.5">
            <label htmlFor="checkout-courier" className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sky-900 dark:text-sky-100">
              Ada ongkos kirim — siapa yang mengantar? * <NewBadge feature="fitur/antar-barang-pengantar" />
            </label>
            {courierProblem ? (
              <p className="text-xs font-medium text-destructive">{courierProblem}</p>
            ) : couriers === null ? (
              <p className="text-xs text-muted-foreground">Memuat daftar pengantar…</p>
            ) : couriers.length === 0 ? (
              <p className="text-xs font-medium text-destructive">
                Belum ada pengantar terdaftar. Minta Owner/GM menambahkannya di Back Office → Pengaturan → Groomer &amp; Pengantar.
              </p>
            ) : (
              <select
                id="checkout-courier"
                value={courierId}
                onChange={(e) => setCourierId(e.target.value)}
                className="w-full min-h-[40px] rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="">-- Pilih pengantar --</option>
                {couriers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
            {!courierProblem && ongkirLine && (
              <label className="mt-2 flex items-start gap-2 text-xs text-sky-900 dark:text-sky-100">
                <input
                  type="checkbox"
                  checked={freeShipping}
                  onChange={(e) => setFreeShipping(e.target.checked)}
                  className="mt-0.5 h-4 w-4"
                />
                <span>
                  <b>Gratis ongkir</b> (ditanggung toko) — ongkir tercatat{' '}
                  {freeShippingValue != null ? formatRupiah(String(freeShippingValue)) : 'sebesar ongkir standar'}, tidak ditagih ke
                  pelanggan; pengantar tidak dapat bonus.
                </span>
              </label>
            )}
            {freeShippingError && <p className="mt-1 text-xs font-medium text-destructive">{freeShippingError}</p>}
          </div>
        )}

        {/* Chip: bayar gabungan. Diskon dipasang per barang di keranjang, bukan di sini. */}
        <div className="grid gap-2 mb-3">
          <button
            type="button"
            onClick={splitMode ? exitSplitMode : enterSplitMode}
            className={`min-h-[40px] px-3 rounded-lg border text-xs font-semibold transition-colors ${
              splitMode
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-foreground hover:bg-accent'
            }`}
          >
            {splitMode ? '← Bayar Tunggal' : 'Bayar Gabungan'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-3 px-4 py-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm font-semibold flex items-center gap-2">
            <span>⚠️</span> {error}
          </div>
        )}

        {splitMode ? (
          /* ── Split payment editor ─────────────────────────────── */
          <>
            <div className="mb-4 space-y-3">
              {splitLines.map((line) => (
                <div key={line.key} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <select
                      value={line.paymentMethodId}
                      onChange={(e) =>
                        updateSplitLine(line.key, { paymentMethodId: Number(e.target.value) })
                      }
                      className="flex-1 min-h-[44px] px-3 py-2 bg-background border border-input rounded-lg text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {paymentMethods.map((pm) => (
                        <option key={pm.id} value={pm.id}>
                          {pm.name}
                        </option>
                      ))}
                    </select>
                    {splitLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSplitLine(line.key)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                        aria-label="Hapus metode"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={line.amount ? parseInt(line.amount, 10).toLocaleString('id-ID') : ''}
                      onChange={(e) =>
                        updateSplitLine(line.key, { amount: e.target.value.replace(/\D/g, '') })
                      }
                      placeholder="0"
                      className="flex-1 px-3 py-2 bg-background border border-input rounded-lg text-base font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[44px] tabular-nums"
                    />
                    <button
                      type="button"
                      onClick={() => fillSplitRemaining(line.key)}
                      disabled={splitRemainingBig.lte(0)}
                      className="min-h-[44px] px-3 py-2 rounded-lg border border-primary/40 text-primary text-xs font-semibold hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-all whitespace-nowrap"
                    >
                      Isi Sisa
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addSplitLine}
              className="w-full min-h-[44px] mb-4 border border-dashed border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground active:scale-[0.98] transition-all"
            >
              + Tambah Metode
            </button>

            {/* Ringkasan split */}
            <div className="mb-3 px-4 py-3 bg-muted/40 rounded-xl text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Terbayar</span>
                <span className="font-bold tabular-nums">{formatRupiah(splitPaidBig.toString())}</span>
              </div>
              {splitRemainingBig.gt(0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Sisa</span>
                  <span className="font-bold text-destructive tabular-nums">
                    {formatRupiah(splitRemainingBig.toString())}
                  </span>
                </div>
              )}
              {splitDebtBig.gt(0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Jumlah Hutang</span>
                  <span className="font-bold text-orange-600 tabular-nums">
                    {formatRupiah(splitDebtBig.toString())}
                  </span>
                </div>
              )}
            </div>

            {splitNeedsCustomer && (
              <div className="mb-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-400 text-sm font-semibold flex items-center gap-2">
                <span>⚠️</span> Pilih customer terlebih dahulu untuk pembayaran hutang.
              </div>
            )}

            {splitHasDebt && (
              <div className="mb-3">
                <label htmlFor="due-at-split" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">
                  Jatuh Tempo (opsional)
                </label>
                <input
                  id="due-at-split"
                  type="date"
                  value={dueAt}
                  onChange={(e) => setDueAt(e.target.value)}
                  className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px]"
                />
              </div>
            )}
          </>
        ) : (
          /* ── Single payment ───────────────────────────────────── */
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {paymentMethods.map((pm, idx) => (
                <button
                  key={pm.id}
                  type="button"
                  onClick={() => setSelectedPaymentMethodId(pm.id)}
                  title={idx < 9 ? `Alt+${idx + 1}` : undefined}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-sm font-semibold transition-all flex items-center justify-center gap-1.5 ${
                    selectedPaymentMethodId === pm.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-background text-foreground hover:bg-accent'
                  }`}
                >
                  {pm.name}
                  {idx < 9 && (
                    <kbd className="text-[10px] opacity-50 font-mono font-normal">Alt+{idx + 1}</kbd>
                  )}
                </button>
              ))}
            </div>

            {/* Mode Hutang/Kredit */}
            {isDebt ? (
              <>
                {customerId === null && (
                  <div className="mb-3 px-4 py-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl text-yellow-800 dark:text-yellow-400 text-sm font-semibold flex items-center gap-2">
                    <span>⚠️</span> Pilih customer terlebih dahulu untuk transaksi hutang.
                  </div>
                )}
                <div className="mb-3 px-4 py-3 bg-muted/40 rounded-xl text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Jumlah Hutang</span>
                    <span className="font-bold">{formatRupiah(netTotalBig.toString())}</span>
                  </div>
                </div>
                <div className="mb-3">
                  <label htmlFor="due-at" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">
                    Jatuh Tempo (opsional)
                  </label>
                  <input
                    id="due-at"
                    type="date"
                    value={dueAt}
                    onChange={(e) => setDueAt(e.target.value)}
                    className="w-full px-4 py-3 bg-background border border-input rounded-xl text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px]"
                  />
                </div>
              </>
            ) : (
              <>
                {/* Amount paid */}
                <div className="mb-3">
                  <label htmlFor="amount-paid" className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5 ml-1">
                    Jumlah Bayar
                  </label>
                  <input
                    ref={amountInputRef}
                    id="amount-paid"
                    type="text"
                    inputMode="numeric"
                    value={amountPaid ? parseInt(amountPaid, 10).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const intOnly = e.target.value.replace(/\D/g, '')
                      setAmountPaid(intOnly)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && canSubmit) { e.preventDefault(); handleSubmit() }
                    }}
                    placeholder="0"
                    className="w-full px-4 py-4 bg-background border border-input rounded-xl text-lg font-bold text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all min-h-[52px] tabular-nums"
                  />
                  {amountPaid && !isAmountValid && (
                    <p className="text-xs text-destructive mt-1 ml-1">
                      Jumlah bayar kurang dari total transaksi
                    </p>
                  )}
                </div>

                {/* Quick fill buttons */}
                <div className="mb-3 space-y-2">
                  <button
                    type="button"
                    onClick={() => fillAmount(netTotalNum)}
                    title="Uang Pas (F1)"
                    className="w-full min-h-[44px] border border-primary/40 text-primary font-semibold rounded-xl text-sm hover:bg-primary/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1.5"
                  >
                    Uang Pas · {formatRupiah(netTotalBig.toString())}
                    <kbd className="text-[10px] opacity-50 font-mono font-normal">F1</kbd>
                  </button>
                  {isCash && (
                    <div className="grid grid-cols-3 gap-2">
                      {[20000, 50000, 100000].map((denom, i) => {
                        const filled = Math.ceil(netTotalNum / denom) * denom
                        return (
                          <button
                            key={denom}
                            type="button"
                            onClick={() => fillDenomination(denom)}
                            title={`F${i + 2}`}
                            className="min-h-[44px] border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-accent active:scale-[0.98] transition-all px-2 flex flex-col items-center justify-center leading-tight"
                          >
                            <span>
                              {filled >= 1000000
                                ? `${filled / 1000000}jt`
                                : `${filled / 1000}rb`}
                            </span>
                            <kbd className="text-[9px] opacity-40 font-mono font-normal">F{i + 2}</kbd>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}

        {/* Kembalian */}
        {kembalian && (
          <div className="mb-4 flex justify-between items-center px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800">
            <span className="text-sm font-medium text-green-700 dark:text-green-400">Kembalian</span>
            <span className="text-lg font-bold text-green-700 dark:text-green-400 tabular-nums">
              {formatRupiah(kembalian)}
            </span>
          </div>
        )}

        {/* Peringatan koneksi — muncul bila jaringan putus saat modal terbuka */}
        {!isOnline && (
          <div className="mb-3 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span aria-hidden="true">⚠️</span>
            <span className="leading-snug">
              {connectionStatus === 'server-down'
                ? 'Server tidak merespons. Pembayaran ditahan agar transaksi tidak hilang di tengah jalan.'
                : 'Koneksi terputus. Pembayaran ditahan agar transaksi tidak hilang di tengah jalan.'}{' '}
              Rincian pembayaran di layar ini tetap tersimpan — tunggu sampai koneksi pulih.
            </span>
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full min-h-[52px] bg-primary text-primary-foreground rounded-xl text-base font-bold hover:opacity-90 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              Memproses...
            </>
          ) : !isOnline ? (
            <>Menunggu koneksi...</>
          ) : !splitMode && isDebt ? (
            <>Catat Hutang</>
          ) : splitMode && splitHasDebt ? (
            <>Proses & Catat Hutang</>
          ) : (
            <>Proses Pembayaran <kbd className="ml-1 text-xs opacity-50 font-mono font-normal">Enter</kbd></>
          )}
        </button>
      </div>
    </div>
  )
}
