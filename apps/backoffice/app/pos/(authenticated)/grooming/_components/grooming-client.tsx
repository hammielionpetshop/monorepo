'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import type { BootstrapPaymentMethod } from '@/components/pos/pos-client'
import type { ReceiptStoreInfo } from '@/lib/receipt-info'
import { NewBadge } from '@/components/ui/new-badge'
import { printGroomingTickets, type GroomingTicketData } from '@/lib/print-grooming-ticket'
import IntakePanel from './intake-panel'
import OrderListPanel from './order-list-panel'
import GroomingTicketPrint from './grooming-ticket-print'
import { toTicketData, type GroomingOrder, type PersonOption, type ServiceOption } from './types'

type Tab = 'terima' | 'aktif' | 'hotel' | 'selesai'

interface Props {
  paymentMethods: BootstrapPaymentMethod[]
  /** null = belum ada shift terbuka di cabang ini. */
  shiftId: number | null
  isCashierInShift: boolean
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  storeInfo: ReceiptStoreInfo
  canReceiveDebtPayment: boolean
}

export default function GroomingClient(props: Props) {
  const [tab, setTab] = useState<Tab>('terima')
  const [services, setServices] = useState<ServiceOption[]>([])
  const [ongkir, setOngkir] = useState<ServiceOption | null>(null)
  const [groomers, setGroomers] = useState<PersonOption[]>([])
  const [couriers, setCouriers] = useState<PersonOption[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [activeCount, setActiveCount] = useState<number | null>(null)
  // Karcis yang sedang dicetak lewat jalur cadangan browser (window.print).
  const [browserTickets, setBrowserTickets] = useState<GroomingTicketData[]>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [svc, gr, cr] = await Promise.all([
          fetch('/api/pos/grooming/services'),
          fetch('/api/bo/groomers?active=1&role=groomer'),
          fetch('/api/bo/groomers?active=1&role=courier'),
        ])
        if (!svc.ok || !gr.ok || !cr.ok) {
          const data = await (svc.ok ? (gr.ok ? cr : gr) : svc).json().catch(() => ({}))
          if (!cancelled) setLoadError((data as { error?: string }).error ?? 'Gagal memuat data grooming')
          return
        }
        const svcData = (await svc.json()) as { services: ServiceOption[]; ongkir: ServiceOption | null }
        if (cancelled) return
        setServices(svcData.services)
        setOngkir(svcData.ongkir)
        setGroomers(await gr.json())
        setCouriers(await cr.json())
        setLoaded(true)
      } catch {
        if (!cancelled) setLoadError('Terjadi kesalahan jaringan saat memuat data grooming')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  // Angka kecil di tab "Sedang Dikerjakan".
  useEffect(() => {
    let cancelled = false
    fetch('/api/pos/grooming/orders?view=aktif')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && Array.isArray(data)) setActiveCount(data.length)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  const printOrders = useCallback(
    async (orders: GroomingOrder[]) => {
      if (orders.length === 0) return
      // Catat tiap cetakan; cetakan kedua dan seterusnya bertanda CETAK ULANG.
      const tickets: GroomingTicketData[] = []
      for (const order of orders) {
        let isReprint = order.ticketPrintCount > 0
        try {
          const res = await fetch(`/api/pos/grooming/orders/${order.id}/ticket-printed`, { method: 'POST' })
          if (res.ok) isReprint = Boolean(((await res.json()) as { isReprint?: boolean }).isReprint)
        } catch {
          // pencatatan gagal tidak menghalangi cetak
        }
        tickets.push(toTicketData(order, props.storeInfo.storeName, isReprint))
      }
      setBrowserTickets(tickets)
      const route = await printGroomingTickets(tickets, () => {
        // Beri waktu React menaruh karcis di halaman sebelum dialog cetak browser dibuka.
        setTimeout(() => window.print(), 150)
      })
      if (route === 'qz' || route === 'bluetooth') toast.success(`Karcis dicetak (${tickets.length * 2} lembar)`)
    },
    [props.storeInfo.storeName],
  )

  const printTransaction = useCallback(
    async (transactionId: number) => {
      setRefreshKey((k) => k + 1)
      try {
        const res = await fetch(`/api/pos/grooming/orders?transactionId=${transactionId}`)
        if (!res.ok) throw new Error('gagal')
        await printOrders((await res.json()) as GroomingOrder[])
      } catch {
        toast.error('Nota tersimpan, tetapi karcis gagal dicetak. Cetak dari tab Sedang Dikerjakan.')
      }
    },
    [printOrders],
  )

  const tabs: { id: Tab; label: string }[] = [
    { id: 'terima', label: 'Terima Kucing' },
    { id: 'aktif', label: activeCount != null && activeCount > 0 ? `Sedang Dikerjakan (${activeCount})` : 'Sedang Dikerjakan' },
    { id: 'hotel', label: 'Hotel' },
    { id: 'selesai', label: 'Sudah Selesai' },
  ]

  const canIntake = props.shiftId !== null && props.isCashierInShift

  return (
    <div className="mx-auto w-full max-w-5xl p-3 sm:p-4">
      <GroomingTicketPrint tickets={browserTickets} />

      <div className="mb-3 flex items-center gap-2">
        <h1 className="text-lg font-semibold">Grooming</h1>
        <NewBadge feature="/pos/grooming" />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg border border-border bg-card p-1 sm:grid-cols-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-md px-3 py-2 text-sm font-semibold ${
              tab === t.id ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.label}
            {t.id === 'hotel' && <span className="ml-1 text-xs font-normal opacity-80">· Segera hadir</span>}
          </button>
        ))}
      </div>

      {loadError && (
        <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{loadError}</div>
      )}

      {tab === 'terima' &&
        (!canIntake ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-6 text-center text-sm text-amber-900">
            <p className="font-semibold">
              {props.shiftId === null ? 'Belum ada shift yang terbuka di cabang ini.' : 'Anda belum bergabung di shift yang sedang berjalan.'}
            </p>
            <p className="mt-1">Menerima kucing membuat nota, jadi shift harus terbuka dulu.</p>
            <Link href="/pos" className="mt-3 inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              Buka tab Kasir
            </Link>
          </div>
        ) : !loaded ? (
          !loadError && <p className="text-sm text-muted-foreground">Memuat…</p>
        ) : services.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada jasa grooming yang punya harga di cabang ini. Minta Owner/GM menandai produknya sebagai “Jasa Grooming”
            dan mengisi harganya.
          </div>
        ) : groomers.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Belum ada groomer terdaftar. Minta Owner/GM menambahkannya di Back Office → Pengaturan → Groomer &amp; Pengantar.
          </div>
        ) : (
          <IntakePanel
            services={services}
            ongkir={ongkir}
            groomers={groomers}
            couriers={couriers}
            paymentMethods={props.paymentMethods}
            shiftId={props.shiftId as number}
            cashierId={props.cashierId}
            cashierName={props.cashierName}
            branchId={props.branchId}
            branchName={props.branchName}
            storeInfo={props.storeInfo}
            onNotaSaved={(transactionId) => { void printTransaction(transactionId) }}
          />
        ))}

      {(tab === 'aktif' || tab === 'selesai') && (
        <OrderListPanel
          key={tab}
          view={tab}
          paymentMethods={props.paymentMethods}
          hasOpenShift={canIntake}
          canReceiveDebtPayment={props.canReceiveDebtPayment}
          refreshKey={refreshKey}
          onPrint={(orders) => { void printOrders(orders) }}
          onChanged={() => setRefreshKey((k) => k + 1)}
        />
      )}

      {tab === 'hotel' && (
        <div className="rounded-lg border border-dashed border-border px-4 py-12 text-center">
          <p className="text-3xl">🏨</p>
          <p className="mt-2 text-lg font-semibold">Hotel Kucing</p>
          <p className="text-sm text-muted-foreground">Segera hadir</p>
        </div>
      )}
    </div>
  )
}
