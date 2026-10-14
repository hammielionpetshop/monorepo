'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import CheckoutModal from '@/components/pos/checkout-modal'
import { newCheckoutRequestId } from '@/components/pos/checkout-request-id'
import type { BootstrapPaymentMethod } from '@/components/pos/pos-client'
import { useCartStore, hasServiceLines, type CartItem } from '@/components/pos/cart-store'
import type { ReceiptStoreInfo } from '@/lib/receipt-info'
import { formatPetAge } from '@/lib/pet-age'
import { RequiredChoiceDialog } from '@/components/ui/required-choice-dialog'
import LineDiscountDialog from '@/components/pos/line-discount-dialog'
import { manualDiscountReasonLabel } from '@/lib/manual-discount'
import { NewBadge } from '@/components/ui/new-badge'
import { freeShippingQty } from '@/lib/ongkir'
import {
  buildGroomingCartItems, cartTotal, formatRp, intakeLineAmounts, priceForTier,
  type IntakeLine, type Owner, type OwnerPet, type PersonOption, type ServiceOption,
} from './types'

interface Props {
  services: ServiceOption[]
  ongkir: ServiceOption | null
  /** Nilai gratis ongkir dari Pengaturan (null = belum termuat). */
  freeShippingValue: number | null
  groomers: PersonOption[]
  couriers: PersonOption[]
  paymentMethods: BootstrapPaymentMethod[]
  shiftId: number
  cashierId: number
  cashierName: string
  branchId: number
  branchName: string
  storeInfo: ReceiptStoreInfo
  /** Nota tersimpan & layar bayar ditutup → cetak karcis nota ini. */
  onNotaSaved: (transactionId: number) => void
}

const inputClass =
  'w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring'
const boxClass = 'rounded-lg border border-border bg-card p-4'
const titleClass = 'mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground'

const emptyPetForm = { name: '', species: '', color: '', ageYears: '', ageMonths: '' }

export default function IntakePanel(props: Props) {
  const { services, ongkir, groomers, couriers } = props
  const router = useRouter()

  // ── Pemilik
  const [owner, setOwner] = useState<Owner | null>(null)
  const [ownerQuery, setOwnerQuery] = useState('')
  const [ownerResults, setOwnerResults] = useState<Owner[]>([])
  const [searching, setSearching] = useState(false)
  const [newOwnerMode, setNewOwnerMode] = useState(false)
  const [newOwner, setNewOwner] = useState({ name: '', phone: '' })

  // ── Kucing
  const [petFormOpen, setPetFormOpen] = useState(false)
  const [petForm, setPetForm] = useState(emptyPetForm)
  const [savingPet, setSavingPet] = useState(false)
  const [duplicateOwner, setDuplicateOwner] = useState<{ id: number; name: string; phone: string | null } | null>(null)

  // ── Baris yang sedang diisi
  const [selectedPetId, setSelectedPetId] = useState<number | null>(null)
  const [serviceId, setServiceId] = useState('')
  const [groomerId, setGroomerId] = useState('')
  const [condition, setCondition] = useState('')

  // ── Daftar & delivery
  const [lines, setLines] = useState<IntakeLine[]>([])
  const [deliveryOn, setDeliveryOn] = useState(false)
  const [address, setAddress] = useState('')
  const [courierId, setCourierId] = useState('')
  const [ongkirQty, setOngkirQty] = useState('')
  const [freeDelivery, setFreeDelivery] = useState(false)

  const [error, setError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<{ items: CartItem[]; requestId: string; debt: boolean } | null>(null)
  const [savedTransactionId, setSavedTransactionId] = useState<number | null>(null)
  // "Tambah belanja" saat keranjang tab Kasir sudah berisi grooming lain: tanya dulu sebelum mengganti.
  const [replaceItems, setReplaceItems] = useState<CartItem[] | null>(null)
  // Popup Diskon untuk satu ekor di daftar (id kucingnya).
  const [discountPetId, setDiscountPetId] = useState<number | null>(null)
  const discountLine = discountPetId == null ? undefined : lines.find((l) => l.pet.id === discountPetId)

  // Cari pemilik: nama atau nomor HP yang sudah terdaftar → muncul beserta kucingnya.
  useEffect(() => {
    if (owner || newOwnerMode) return
    const q = ownerQuery.trim()
    if (q.length < 2) {
      setOwnerResults([])
      return
    }
    const ctrl = new AbortController()
    const t = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/bo/pets/owners?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        if (res.ok) setOwnerResults(await res.json())
      } catch {
        // pencarian dibatalkan / jaringan — biarkan hasil lama
      } finally {
        setSearching(false)
      }
    }, 250)
    return () => {
      clearTimeout(t)
      ctrl.abort()
    }
  }, [owner, newOwnerMode, ownerQuery])

  const tier = owner?.tierType ?? 'RETAIL'
  const ongkirUnit = ongkir ? Number(priceForTier(ongkir.tierPrices, tier)?.price ?? 0) : 0
  // Gratis antar-jemput: qty dikunci ke nilai standar (mesin ongkir), kasir tidak menghitung jarak.
  const freeQty = props.freeShippingValue != null ? freeShippingQty(props.freeShippingValue, ongkirUnit) : null
  const effectiveOngkirQty = freeDelivery ? (freeQty != null ? String(freeQty) : '') : ongkirQty
  const usedPetIds = useMemo(() => new Set(lines.map((l) => l.pet.id)), [lines])
  const selectedPet = owner?.pets.find((p) => p.id === selectedPetId) ?? null
  const selectedService = services.find((s) => String(s.productId) === serviceId) ?? null
  const servicePrice = selectedService ? priceForTier(selectedService.tierPrices, tier) : null

  function pickOwner(o: Owner) {
    setOwner(o)
    setAddress(o.address ?? '')
    setOwnerResults([])
    setOwnerQuery('')
    setNewOwnerMode(false)
    setDuplicateOwner(null)
    setError(null)
    if (o.pets.length === 0) setPetFormOpen(true)
  }

  function resetAll() {
    setOwner(null)
    setOwnerQuery('')
    setOwnerResults([])
    setNewOwnerMode(false)
    setNewOwner({ name: '', phone: '' })
    setPetFormOpen(false)
    setPetForm(emptyPetForm)
    setDuplicateOwner(null)
    setSelectedPetId(null)
    setServiceId('')
    setGroomerId('')
    setCondition('')
    setLines([])
    setDeliveryOn(false)
    setAddress('')
    setCourierId('')
    setOngkirQty('')
    setFreeDelivery(false)
    setError(null)
    setCheckout(null)
    setSavedTransactionId(null)
  }

  async function pickPhoneOwner(existing: { id: number; name: string; phone: string | null }) {
    // Nomor sudah terdaftar → pakai pelanggan itu (ambil lagi beserta kucingnya).
    try {
      const res = await fetch(`/api/bo/pets/owners?q=${encodeURIComponent(existing.phone ?? existing.name)}`)
      const found: Owner[] = res.ok ? await res.json() : []
      const match = found.find((o) => o.id === existing.id)
      pickOwner(match ?? { id: existing.id, name: existing.name, phone: existing.phone, address: null, tierType: 'RETAIL', pets: [] })
    } catch {
      pickOwner({ id: existing.id, name: existing.name, phone: existing.phone, address: null, tierType: 'RETAIL', pets: [] })
    }
  }

  async function savePet() {
    setError(null)
    setDuplicateOwner(null)
    const years = petForm.ageYears.trim() ? Number(petForm.ageYears) : 0
    const months = petForm.ageMonths.trim() ? Number(petForm.ageMonths) : 0
    if (!owner && (!newOwner.name.trim() || !newOwner.phone.trim())) {
      setError('Nama pemilik dan nomor HP wajib diisi')
      return
    }
    if (!petForm.name.trim() || !petForm.species.trim() || !petForm.color.trim()) {
      setError('Nama, jenis, dan warna kucing wajib diisi')
      return
    }
    if (!(years > 0 || months > 0)) {
      setError('Umur kucing wajib diisi (tahun atau bulan)')
      return
    }
    setSavingPet(true)
    try {
      const res = await fetch('/api/bo/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: petForm.name.trim(), species: petForm.species.trim(), color: petForm.color.trim(), ageYears: years, ageMonths: months,
          ...(owner ? { customerId: owner.id } : { newOwner: { name: newOwner.name.trim(), phone: newOwner.phone.trim() } }),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? `Gagal menyimpan data kucing (${res.status})`)
        if (data.existingOwner) setDuplicateOwner(data.existingOwner)
        return
      }
      const pet: OwnerPet = { id: data.id, name: data.name, species: data.species, color: data.color, birthDate: data.birthDate }
      if (owner) {
        setOwner({ ...owner, pets: [...owner.pets, pet] })
      } else {
        setOwner({ id: data.customerId, name: data.ownerName, phone: data.ownerPhone, address: null, tierType: 'RETAIL', pets: [pet] })
        setNewOwnerMode(false)
      }
      setSelectedPetId(pet.id)
      setPetForm(emptyPetForm)
      setPetFormOpen(false)
    } catch {
      setError('Terjadi kesalahan jaringan, silakan coba lagi')
    } finally {
      setSavingPet(false)
    }
  }

  function addLine() {
    setError(null)
    if (!selectedPet) return setError('Pilih kucingnya dulu')
    if (usedPetIds.has(selectedPet.id)) return setError(`${selectedPet.name} sudah ada di daftar`)
    if (!selectedService) return setError('Pilih jasanya')
    if (!servicePrice) return setError(`${selectedService.name} belum punya harga di cabang ini`)
    const groomer = groomers.find((g) => String(g.id) === groomerId)
    if (!groomer) return setError('Pilih groomer yang mengerjakan')
    if (!condition.trim()) return setError('Kondisi kucing hari ini wajib diisi')
    setLines([...lines, { pet: selectedPet, service: selectedService, groomer, condition: condition.trim() }])
    setSelectedPetId(null)
    setCondition('')
  }

  /** Periksa isian lalu susun baris nota; null = ada yang kurang (pesannya sudah ditampilkan). */
  function prepareItems(): CartItem[] | null {
    setError(null)
    const fail = (message: string) => {
      setError(message)
      return null
    }
    if (!owner) return fail('Pilih pemilik kucing dulu')
    if (lines.length === 0) return fail('Belum ada kucing di daftar')
    let delivery = null
    if (deliveryOn) {
      const courier = couriers.find((c) => String(c.id) === courierId)
      const qty = Number(effectiveOngkirQty)
      if (!ongkir) return fail('Produk ongkos kirim belum tersedia di cabang ini — hubungi Owner')
      if (freeDelivery && freeQty == null) return fail('Nilai gratis ongkir tidak cocok dengan harga ongkir — hubungi Owner')
      if (!address.trim()) return fail('Alamat delivery wajib diisi')
      if (!courier) return fail('Pilih pengantar-jemputnya')
      if (!Number.isInteger(qty) || qty <= 0) return fail('Isi qty ongkos kirim (angka bulat lebih dari 0)')
      delivery = { courier, address: address.trim(), qty, free: freeDelivery, freeValue: props.freeShippingValue ?? undefined }
    }
    try {
      return buildGroomingCartItems(lines, tier, delivery, ongkir)
    } catch (e) {
      return fail(e instanceof Error ? e.message : 'Daftar tidak bisa diproses')
    }
  }

  function openCheckout(debt: boolean) {
    const items = prepareItems()
    if (!items) return
    if (debt && !props.paymentMethods.some((m) => m.type === 'DEBT')) {
      return setError('Metode Piutang belum tersedia — bayar saat ambil tidak bisa dipakai. Hubungi Owner.')
    }
    setSavedTransactionId(null)
    setCheckout({ items, requestId: newCheckoutRequestId(), debt })
  }

  // "Tambah belanja": baris grooming pindah ke keranjang tab Kasir supaya jadi SATU nota dengan
  // barang. Pembayaran & karcis diselesaikan dari sana (karcis dicetak begitu nota tersimpan).
  function addShopping() {
    const items = prepareItems()
    if (!items || !owner) return
    const cart = useCartStore.getState()
    if (cart.sourceIbt) {
      return setError('Keranjang tab Kasir sedang memproses PO Internal. Selesaikan atau batalkan dulu, baru tekan Tambah belanja.')
    }
    if (hasServiceLines(cart.items)) return setReplaceItems(items)
    moveToCashier(items)
  }

  function moveToCashier(items: CartItem[]) {
    if (!owner) return
    useCartStore.getState().addServiceLines(items, { id: owner.id, name: owner.name, tierType: owner.tierType })
    router.push('/pos')
  }

  const previewTotal = lines.reduce((sum, l) => sum + intakeLineAmounts(l, tier).net, 0)
    + (deliveryOn && !freeDelivery && Number(effectiveOngkirQty) > 0 ? Number(effectiveOngkirQty) * ongkirUnit : 0)

  return (
    <div className="space-y-4">
      {checkout && owner && (
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
          customerId={owner.id}
          customerName={owner.name}
          customerTier={owner.tierType}
          clientRequestId={checkout.requestId}
          initialPaymentType={checkout.debt ? 'DEBT' : undefined}
          onSaved={(saved) => setSavedTransactionId(saved.transactionId)}
          onClose={() => {
            // Layar bayar ditutup: kalau notanya sudah tersimpan, lanjut cetak karcis & kosongkan form.
            if (savedTransactionId) {
              props.onNotaSaved(savedTransactionId)
              resetAll()
            } else {
              setCheckout(null)
            }
          }}
          onSuccess={() => {
            if (savedTransactionId) props.onNotaSaved(savedTransactionId)
            resetAll()
          }}
        />
      )}

      {discountLine && (
        <LineDiscountDialog
          productName={`${discountLine.service.name} - ${discountLine.pet.name}`}
          qty={1}
          unitPrice={String(intakeLineAmounts(discountLine, tier).price)}
          current={discountLine.discount}
          onClose={() => setDiscountPetId(null)}
          onRemove={() => {
            setLines(lines.map((l) => (l.pet.id === discountLine.pet.id ? { ...l, discount: undefined } : l)))
            setDiscountPetId(null)
          }}
          onSave={(entry) => {
            setLines(lines.map((l) => (l.pet.id === discountLine.pet.id ? { ...l, discount: entry } : l)))
            setDiscountPetId(null)
          }}
        />
      )}

      {replaceItems && (
        <RequiredChoiceDialog
          title="Keranjang Kasir sudah berisi grooming lain"
          tone="warning"
          actions={[
            { label: 'Batal', variant: 'secondary', onClick: () => setReplaceItems(null) },
            { label: 'Ganti dengan daftar ini', variant: 'primary', onClick: () => moveToCashier(replaceItems) },
          ]}
        >
          <p>Di keranjang tab Kasir masih ada grooming yang belum dibayar.</p>
          <p>
            Bila diganti, grooming yang lama keluar dari keranjang (belum ada notanya) dan harus diisi ulang. Barang belanjaan
            di keranjang tetap ada.
          </p>
        </RequiredChoiceDialog>
      )}

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          {duplicateOwner && (
            <button
              type="button"
              onClick={() => { void pickPhoneOwner(duplicateOwner) }}
              className="mt-2 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
            >
              Pakai pelanggan {duplicateOwner.name}
            </button>
          )}
        </div>
      )}

      {/* ── PEMILIK ── */}
      <section className={boxClass}>
        <h2 className={titleClass}>1. Pemilik</h2>
        {owner ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-green-500/20 bg-green-500/10 px-3 py-2">
            <div className="text-sm">
              <b>{owner.name}</b> {owner.phone ? `— ${owner.phone}` : ''}
              {owner.tierType !== 'RETAIL' && <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs">{owner.tierType}</span>}
            </div>
            <button type="button" onClick={resetAll} className="text-xs font-medium text-primary hover:underline">
              Ganti pemilik (mulai ulang)
            </button>
          </div>
        ) : newOwnerMode ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Nama pemilik *</label>
              <input className={inputClass} value={newOwner.name} maxLength={100} onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Nomor HP *</label>
              <input className={inputClass} type="tel" inputMode="numeric" value={newOwner.phone} maxLength={20} onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Pemilik baru otomatis menjadi pelanggan. Isi data kucingnya di bawah, lalu tekan Simpan Kucing.
            </p>
            <button type="button" onClick={() => { setNewOwnerMode(false); setPetFormOpen(false) }} className="justify-self-start text-xs font-medium text-primary hover:underline">
              ← Cari pemilik yang sudah terdaftar
            </button>
          </div>
        ) : (
          <>
            <input
              className={inputClass}
              value={ownerQuery}
              onChange={(e) => setOwnerQuery(e.target.value)}
              placeholder="Ketik nama atau nomor HP pemilik"
              autoFocus
            />
            {searching && <p className="mt-2 text-xs text-muted-foreground">Mencari…</p>}
            {ownerResults.length > 0 && (
              <ul className="mt-2 max-h-56 overflow-y-auto rounded-md border border-border">
                {ownerResults.map((o) => (
                  <li key={o.id} className="border-b border-border last:border-b-0">
                    <button type="button" onClick={() => pickOwner(o)} className="block w-full px-3 py-2 text-left text-sm hover:bg-muted">
                      <span className="font-medium">{o.name}</span> <span className="text-muted-foreground">{o.phone ?? 'tanpa nomor'}</span>
                      <span className="block text-xs text-muted-foreground">
                        {o.pets.length > 0 ? `Kucing: ${o.pets.map((p) => p.name).join(', ')}` : 'Belum ada data kucing'}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {ownerQuery.trim().length >= 2 && !searching && ownerResults.length === 0 && (
              <p className="mt-2 text-xs text-muted-foreground">Tidak ditemukan.</p>
            )}
            <button
              type="button"
              onClick={() => { setNewOwnerMode(true); setPetFormOpen(true); setNewOwner({ name: '', phone: '' }) }}
              className="mt-3 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
            >
              + Pemilik baru
            </button>
          </>
        )}
      </section>

      {/* ── KUCING ── */}
      {(owner || newOwnerMode) && (
        <section className={boxClass}>
          <h2 className={titleClass}>2. Kucing</h2>
          {owner && (
            <div className="flex flex-wrap gap-2">
              {owner.pets.map((p) => {
                const used = usedPetIds.has(p.id)
                const active = selectedPetId === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={used}
                    onClick={() => setSelectedPetId(p.id)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm ${
                      active ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                    } ${used ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {p.species}, {p.color}, {formatPetAge(p.birthDate)}
                    </span>
                    {used && <span className="block text-xs text-green-700">sudah di daftar</span>}
                  </button>
                )
              })}
              {!petFormOpen && (
                <button type="button" onClick={() => setPetFormOpen(true)} className="rounded-lg border border-dashed border-border px-3 py-2 text-sm font-medium hover:bg-muted">
                  + Kucing baru
                </button>
              )}
            </div>
          )}

          {petFormOpen && (
            <div className="mt-3 grid gap-3 rounded-md border border-border p-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Nama kucing *</label>
                <input className={inputClass} value={petForm.name} maxLength={100} onChange={(e) => setPetForm({ ...petForm, name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Jenis *</label>
                <input className={inputClass} value={petForm.species} maxLength={60} placeholder="mis. Persia, Domestik" onChange={(e) => setPetForm({ ...petForm, species: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Warna *</label>
                <input className={inputClass} value={petForm.color} maxLength={60} placeholder="mis. putih, oranye" onChange={(e) => setPetForm({ ...petForm, color: e.target.value })} />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Umur *</label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center gap-2">
                    <input className={inputClass} type="number" min="0" max="40" value={petForm.ageYears} onChange={(e) => setPetForm({ ...petForm, ageYears: e.target.value })} />
                    <span className="text-sm text-muted-foreground">tahun</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input className={inputClass} type="number" min="0" max="11" value={petForm.ageMonths} onChange={(e) => setPetForm({ ...petForm, ageMonths: e.target.value })} />
                    <span className="text-sm text-muted-foreground">bulan</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 sm:col-span-2">
                <button type="button" disabled={savingPet} onClick={() => { void savePet() }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50">
                  {savingPet ? 'Menyimpan…' : 'Simpan Kucing'}
                </button>
                {owner && (
                  <button type="button" disabled={savingPet} onClick={() => { setPetFormOpen(false); setPetForm(emptyPetForm) }} className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                    Batal
                  </button>
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── JASA UNTUK KUCING INI ── */}
      {owner && selectedPet && (
        <section className={boxClass}>
          <h2 className={titleClass}>3. Jasa untuk {selectedPet.name}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Jasa *</label>
              <select className={inputClass} value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
                <option value="">-- Pilih jasa --</option>
                {services.map((s) => {
                  const p = priceForTier(s.tierPrices, tier)
                  return (
                    <option key={s.productId} value={s.productId}>
                      {s.name} — {p ? formatRp(p.price) : 'belum ada harga'}
                    </option>
                  )
                })}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Groomer * (1 orang)</label>
              <select className={inputClass} value={groomerId} onChange={(e) => setGroomerId(e.target.value)}>
                <option value="">-- Pilih groomer --</option>
                {groomers.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium">Kondisi kucing hari ini *</label>
              <textarea
                className={inputClass}
                rows={2}
                maxLength={500}
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                placeholder="mis. sehat; ada luka kecil di telinga kiri; galak kalau dipegang perutnya"
              />
            </div>
            <button type="button" onClick={addLine} className="justify-self-start rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">
              + Tambah ke daftar
            </button>
          </div>
        </section>
      )}

      {/* ── DELIVERY ── */}
      {owner && lines.length > 0 && (
        <section className={boxClass}>
          <h2 className={titleClass}>4. Delivery (antar-jemput)</h2>
          <div className="flex gap-2">
            {[false, true].map((value) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setDeliveryOn(value)}
                className={`rounded-lg border px-5 py-2 text-sm font-semibold ${
                  deliveryOn === value ? 'border-primary bg-primary/10 text-primary' : 'border-border hover:bg-muted'
                }`}
              >
                {value ? 'Ya, diantar-jemput' : 'Tidak, diambil sendiri'}
              </button>
            ))}
          </div>
          {deliveryOn && (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">Alamat *</label>
                <textarea className={inputClass} rows={2} maxLength={500} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Nama jalan, nomor rumah, patokan" />
                <p className="mt-1 text-xs text-muted-foreground">
                  Tersimpan di data pelanggan. Boleh dilengkapi kapan saja (mis. tambah nomor rumah).
                </p>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Pengantar-jemput *</label>
                <select className={inputClass} value={courierId} onChange={(e) => setCourierId(e.target.value)}>
                  <option value="">-- Pilih pengantar --</option>
                  {couriers.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {couriers.length === 0 && (
                  <p className="mt-1 text-xs text-amber-700">Belum ada pengantar terdaftar. Minta Owner/GM menambahkannya di Pengaturan → Groomer &amp; Pengantar.</p>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Ongkos kirim (qty × {formatRp(ongkirUnit)}) *</label>
                <div className="flex items-center gap-2">
                  <input className={inputClass} type="number" min="1" inputMode="numeric" value={effectiveOngkirQty} disabled={freeDelivery} onChange={(e) => setOngkirQty(e.target.value)} placeholder="mis. 15" />
                  <span className="whitespace-nowrap text-sm font-semibold">
                    = {formatRp(Number(effectiveOngkirQty) > 0 ? Number(effectiveOngkirQty) * ongkirUnit : 0)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Sekali per nota, untuk antar-jemput (tarif flat).</p>
              </div>
              <label className="flex items-start gap-2 text-sm sm:col-span-2">
                <input type="checkbox" className="mt-1 h-4 w-4" checked={freeDelivery} onChange={(e) => setFreeDelivery(e.target.checked)} />
                <span>
                  <b>Gratis antar-jemput</b> (ditanggung toko) <NewBadge feature="fitur/antar-barang-pengantar" />
                  <span className="block text-xs text-muted-foreground">
                    Ongkir tercatat sebesar ongkir standar{props.freeShippingValue != null ? ` (${formatRp(props.freeShippingValue)})` : ''}, tidak ditagih ke pelanggan. Pengantar tidak dapat bonus.
                  </span>
                </span>
              </label>
            </div>
          )}
        </section>
      )}

      {/* ── DAFTAR ── */}
      {owner && (
        <section className={boxClass}>
          <h2 className={titleClass}>Daftar</h2>
          {lines.length === 0 ? (
            <p className="text-sm text-muted-foreground">Belum ada kucing. Pilih kucing di atas, isi jasa, groomer, dan kondisinya.</p>
          ) : (
            <ul className="divide-y divide-border text-sm">
              {lines.map((l, i) => {
                const amounts = intakeLineAmounts(l, tier)
                return (
                <li key={l.pet.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div>
                    <span className="font-semibold">{i + 1}. {l.pet.name}</span> — {l.service.name} — Groomer: {l.groomer.name}
                    <span className="block text-xs text-muted-foreground">Kondisi: {l.condition}</span>
                    {l.discount && amounts.discount > 0 && (
                      <span className="block text-xs font-medium text-orange-600">
                        Diskon −{formatRp(amounts.discount)} · {manualDiscountReasonLabel(l.discount.reasonCode, l.discount.reasonNote)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums">
                      {amounts.discount > 0 && <s className="mr-1 font-normal text-muted-foreground">{formatRp(amounts.price)}</s>}
                      {formatRp(amounts.net)}
                    </span>
                    <button type="button" onClick={() => setDiscountPetId(l.pet.id)} className="text-xs font-medium text-orange-700 hover:underline">
                      {l.discount ? 'Ubah diskon' : '+ Diskon'}
                    </button>
                    <button type="button" onClick={() => setLines(lines.filter((x) => x.pet.id !== l.pet.id))} className="text-xs font-medium text-destructive hover:underline">
                      Hapus
                    </button>
                  </div>
                </li>
                )
              })}
              {deliveryOn && Number(effectiveOngkirQty) > 0 && (
                <li className="flex items-center justify-between py-2">
                  <span>Ongkos kirim (antar-jemput){freeDelivery ? ' — GRATIS' : ` — ${effectiveOngkirQty} × ${formatRp(ongkirUnit)}`}</span>
                  <span className="font-semibold tabular-nums">
                    {freeDelivery ? <><s className="text-muted-foreground">{formatRp(Number(effectiveOngkirQty) * ongkirUnit)}</s> Rp 0</> : formatRp(Number(effectiveOngkirQty) * ongkirUnit)}
                  </span>
                </li>
              )}
              <li className="flex items-center justify-between py-2 text-base font-bold">
                <span>TOTAL</span>
                <span className="tabular-nums">{formatRp(previewTotal)}</span>
              </li>
            </ul>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Diskon diberikan per kucing lewat tombol “+ Diskon” di daftar ini (wajib pilih alasan). Pelanggan sekalian belanja barang? Tekan “Tambah
            belanja” — grooming pindah ke keranjang tab Kasir dan dibayar satu nota dengan barangnya.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => openCheckout(false)}
              className="rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Lunas sekarang
            </button>
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={addShopping}
              className="rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/20 disabled:opacity-50"
            >
              + Tambah belanja (satu nota)
            </button>
            <button
              type="button"
              disabled={lines.length === 0}
              onClick={() => openCheckout(true)}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-500/20 disabled:opacity-50"
            >
              Bayar saat ambil (piutang)
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
