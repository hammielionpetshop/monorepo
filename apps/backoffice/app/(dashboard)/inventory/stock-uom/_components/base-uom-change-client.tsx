'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ProductSelect } from '@/components/ui/product-select'
import type { BaseUomChangePlan } from '@/lib/services/base-uom-change-service'

interface ProductOption {
  id: number
  name: string
  sku: string | null
  baseUomId: number
  baseUomCode: string | null
}

interface UomOption {
  id: number
  code: string
  name: string
}

interface Props {
  products: ProductOption[]
  uoms: UomOption[]
}

const rp = (n: number | null) => (n == null ? '—' : `Rp ${n.toLocaleString('id-ID')}`)
const num = (n: number) => n.toLocaleString('id-ID')
const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' }) : '—'

function StepTitle({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">{n}</span>
      {children}
    </h2>
  )
}

function Guide() {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-lg border border-sky-500/30 bg-sky-500/5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        📖 Cara pakai (baca dulu kalau baru pertama kali)
        <span className="text-xs font-normal text-muted-foreground">{open ? 'Sembunyikan' : 'Tampilkan'}</span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-sky-500/20 px-4 py-3 text-sm text-foreground">
          <p>
            <b>Kapan dipakai?</b> Kalau satuan dasar barang salah, terpasang satuan besar
            (contoh: <b>SAK</b>), padahal harusnya satuan paling kecil (contoh: <b>PCS</b>).
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li><b>Pilih barang</b> yang salah satuannya.</li>
            <li><b>Pilih satuan dasar baru</b>, yaitu satuan paling kecil (contoh: PCS).</li>
            <li>
              <b>Isi 1 satuan lama = berapa satuan baru.</b> Contoh: 1 SAK isinya 25 PCS, ketik <b>25</b>.
              Kalau ragu, <b>buka dan hitung barangnya</b> dulu. Angka ini yang paling penting.
            </li>
            <li>
              Klik <b>Lihat Pratinjau</b>. Belum ada yang berubah. Periksa: apakah stok baru masuk akal?
              (contoh: 4 SAK jadi 100 PCS)
            </li>
            <li>Kalau sudah benar, <b>ketik nama barangnya</b> di kotak konfirmasi, lalu klik <b>Jalankan Migrasi</b>.</li>
            <li>
              Terakhir, <b>isi harga jual satuan baru</b> di Manajemen Harga. Tombolnya muncul setelah migrasi
              selesai. Selama belum diisi, kasir belum bisa menjual per satuan baru.
            </li>
          </ol>
          <div className="rounded-md bg-amber-500/10 px-3 py-2 text-xs">
            ⚠️ <b>Tidak bisa dibatalkan dengan 1 klik.</b> Kalau angka isinya salah, stok ikut salah.
            Jadi pastikan angka isinya benar sebelum klik Jalankan. Kalau terlanjur salah, hubungi tim IT
            (perubahan tercatat lengkap, jadi bisa ditelusuri).
          </div>
          <p className="text-xs text-muted-foreground">
            Yang otomatis diurus sistem: stok di semua cabang, batch stok (modal, tanggal kedaluwarsa,
            urutan FIFO tetap), modal di Manajemen Harga, konversi satuan, dan riwayat penyesuaian stok.
            Nota lama tidak diubah.
          </p>
        </div>
      )}
    </div>
  )
}

export default function BaseUomChangeClient({ products, uoms }: Props) {
  const [productId, setProductId] = useState('')
  const [newUomId, setNewUomId] = useState('')
  const [ratio, setRatio] = useState('')
  const [plan, setPlan] = useState<BaseUomChangePlan | null>(null)
  const [done, setDone] = useState<BaseUomChangePlan | null>(null)
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState<'preview' | 'execute' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const product = products.find((p) => String(p.id) === productId) ?? null
  const oldCode = product?.baseUomCode ?? 'satuan lama'
  const newCode = uoms.find((u) => String(u.id) === newUomId)?.code ?? 'satuan baru'

  function resetResult() {
    setPlan(null)
    setConfirmName('')
    setError(null)
  }

  async function call(mode: 'preview' | 'execute') {
    if (!product || !newUomId || !ratio) return
    setBusy(mode)
    setError(null)
    try {
      const res = await fetch('/api/bo/inventory/stock-uom/base-change', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          productId: product.id,
          newBaseUomId: Number(newUomId),
          ratio: Number(ratio),
          signature: plan?.signature,
          confirmName,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Gagal')
      if (mode === 'preview') {
        setPlan(json.plan)
        setConfirmName('')
      } else {
        setDone(json.plan)
        setPlan(null)
      }
    } catch (e: unknown) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  function startOver() {
    setDone(null)
    setPlan(null)
    setProductId('')
    setNewUomId('')
    setRatio('')
    setConfirmName('')
    setError(null)
  }

  if (done) {
    return (
      <div className="space-y-4 max-w-3xl">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
          <p className="font-semibold text-emerald-700 dark:text-emerald-400">
            ✅ Berhasil. Satuan dasar {done.product.name} sekarang {done.newUom?.code}.
          </p>
          <p className="mt-1 text-foreground">
            1 {done.oldUom.code} = {num(done.ratio)} {done.newUom?.code}. Stok semua cabang sudah dikonversi.
          </p>
        </div>

        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm space-y-2">
          <p className="font-semibold text-foreground">📝 Tugas berikutnya (jangan dilewati)</p>
          {done.missingPrices.length > 0 ? (
            <>
              <p>Isi harga jual per <b>{done.newUom?.code}</b> di cabang berikut:</p>
              <ul className="list-disc pl-5">
                {done.missingPrices.map((m) => (
                  <li key={m.branchId}><b>{m.branchName}</b>: {m.tiers.join(', ')}</li>
                ))}
              </ul>
            </>
          ) : (
            <p>Cek harga jual per <b>{done.newUom?.code}</b> di Manajemen Harga.</p>
          )}
          <Link
            href={`/master-data/prices?q=${encodeURIComponent(done.product.name)}`}
            className="inline-block rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90"
          >
            Buka Manajemen Harga →
          </Link>
          <p className="text-xs text-muted-foreground">
            Minta kasir menekan tombol muat ulang (refresh) di layar kasir supaya satuan baru terbaca.
          </p>
        </div>

        <button onClick={startOver} className="text-sm text-primary hover:underline">
          Ganti satuan barang lain
        </button>
      </div>
    )
  }

  const canPreview = !!product && !!newUomId && Number(ratio) >= 2 && Number.isInteger(Number(ratio))
  const nameMatches = plan != null && confirmName.trim().toLowerCase() === plan.product.name.trim().toLowerCase()

  return (
    <div className="space-y-5 max-w-4xl">
      <Guide />

      <div className="rounded-lg border border-border bg-card p-4 space-y-4">
        <div className="space-y-2">
          <StepTitle n={1}>Pilih barang</StepTitle>
          <div className="max-w-md">
            <ProductSelect
              products={products.map((p) => ({ id: p.id, name: p.name, sku: p.sku }))}
              value={productId}
              onChange={(v) => { setProductId(v); setNewUomId(''); resetResult() }}
              placeholder="-- Cari nama barang --"
            />
          </div>
          {product && (
            <p className="text-sm text-muted-foreground">
              Satuan dasar sekarang: <b className="text-foreground">{oldCode}</b>
            </p>
          )}
        </div>

        {product && (
          <div className="space-y-2">
            <StepTitle n={2}>Pilih satuan dasar baru (satuan paling kecil)</StepTitle>
            <select
              value={newUomId}
              onChange={(e) => { setNewUomId(e.target.value); resetResult() }}
              className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">-- Pilih satuan --</option>
              {uoms.filter((u) => u.id !== product.baseUomId).map((u) => (
                <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
              ))}
            </select>
          </div>
        )}

        {product && newUomId && (
          <div className="space-y-2">
            <StepTitle n={3}>Isi 1 {oldCode} = berapa {newCode}?</StepTitle>
            <div className="flex items-center gap-2 text-sm">
              <span>1 {oldCode} =</span>
              <input
                inputMode="numeric"
                value={ratio}
                onChange={(e) => { setRatio(e.target.value.replace(/\D/g, '')); resetResult() }}
                placeholder="contoh 25"
                className="w-28 rounded-md border border-border bg-background px-3 py-2 text-right"
              />
              <span>{newCode}</span>
            </div>
            {ratio !== '' && Number(ratio) < 2 && (
              <p className="text-xs text-destructive">Minimal 2. Satuan baru harus lebih kecil dari {oldCode}.</p>
            )}
          </div>
        )}

        <div className="space-y-2">
          <StepTitle n={4}>Lihat pratinjau (belum ada yang berubah)</StepTitle>
          <button
            onClick={() => call('preview')}
            disabled={!canPreview || busy !== null}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {busy === 'preview' ? 'Menghitung...' : 'Lihat Pratinjau'}
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      )}

      {plan && <PlanView plan={plan} />}

      {plan && plan.blockers.length === 0 && (
        <div className="rounded-lg border-2 border-primary/40 bg-card p-4 space-y-3">
          <StepTitle n={5}>Jalankan</StepTitle>
          <p className="text-sm">
            Sudah dicek dan benar? Ketik nama barang <b>{plan.product.name}</b> di bawah ini, lalu klik Jalankan.
          </p>
          <input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder="ketik nama barang di sini"
            className="w-full max-w-md rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <div>
            <button
              onClick={() => call('execute')}
              disabled={!nameMatches || busy !== null}
              className="rounded-md bg-destructive px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-40"
            >
              {busy === 'execute' ? 'Sedang memproses...' : `Jalankan Migrasi (${plan.oldUom.code} → ${plan.newUom?.code})`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function PlanView({ plan }: { plan: BaseUomChangePlan }) {
  const nu = plan.newUom?.code ?? ''
  const ou = plan.oldUom.code
  return (
    <div className="space-y-4">
      {plan.blockers.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm">
          <p className="font-semibold text-destructive">⛔ Belum bisa dijalankan:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-foreground">
            {plan.blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-1">
        <p className="font-semibold text-foreground">Ringkasan: {plan.product.name}</p>
        <p>Satuan dasar: <b>{ou}</b> → <b>{nu}</b> (1 {ou} = {num(plan.ratio)} {nu})</p>
        <p>
          Nilai stok: {rp(plan.value.before)} → {rp(plan.value.after)}
          {plan.value.difference === 0
            ? <span className="ml-1 text-emerald-600 dark:text-emerald-400">✓ sama persis</span>
            : <span className="ml-1 text-amber-600">(selisih {rp(plan.value.difference)} karena pembulatan)</span>}
        </p>
      </div>

      {plan.warnings.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <p className="font-semibold text-foreground">Perlu diketahui:</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {plan.warnings.map((w) => <li key={w}>{w}</li>)}
          </ul>
        </div>
      )}

      <Table title="Stok per cabang" head={['Cabang', 'Sebelum', 'Sesudah']} right={[1, 2]} empty="Belum ada stok di cabang mana pun.">
        {plan.stocks.map((s) => (
          <tr key={s.branchId}>
            <Td>{s.branchName}</Td>
            <Td right>{num(s.oldQty)} {ou}</Td>
            <Td right bold>{num(s.newQty)} {nu}</Td>
          </tr>
        ))}
      </Table>

      <Table
        title="Batch stok (yang masih ada sisanya)"
        head={['Cabang', 'Tgl masuk', 'Kedaluwarsa', 'Sisa', 'Modal']} right={[3, 4]}
        empty="Tidak ada batch bersisa."
      >
        {plan.batches.map((b) => (
          <tr key={b.id}>
            <Td>{b.branchName}</Td>
            <Td>{date(b.receivedAt)}</Td>
            <Td>{date(b.expiryDate)}</Td>
            <Td right>{num(b.oldQtyRemaining)} {ou} → <b>{num(b.newQtyRemaining)} {nu}</b></Td>
            <Td right>{rp(b.oldCost)}/{ou} → <b>{rp(b.newCost)}/{nu}</b></Td>
          </tr>
        ))}
      </Table>

      <Table title="Konversi satuan" head={['Satuan', 'Sesudah']} empty="—">
        {plan.conversions.map((c) => (
          <tr key={c.uomCode}>
            <Td bold>{c.uomCode}</Td>
            <Td>{c.note}</Td>
          </tr>
        ))}
      </Table>

      <Table title={`Modal di Manajemen Harga (per ${nu})`} head={['Cabang', 'Modal baru']} right={[1]} empty={`Belum ada modal ${ou} yang tercatat.`}>
        {plan.costs.map((c) => (
          <tr key={c.branchName}>
            <Td>{c.branchName}</Td>
            <Td right bold>{rp(c.newCost)}/{nu}</Td>
          </tr>
        ))}
      </Table>

      <div className="rounded-lg border border-border bg-card p-4 text-sm space-y-1">
        <p className="font-semibold text-foreground">Harga jual</p>
        <p>Harga jual per {ou} <b>tetap</b> (tidak berubah).</p>
        {plan.missingPrices.length > 0 ? (
          <p>
            Harga jual per <b>{nu}</b> <b>dikosongkan</b> dan harus diisi setelah migrasi di:{' '}
            {plan.missingPrices.map((m) => `${m.branchName} (${m.tiers.join(', ')})`).join('; ')}.
          </p>
        ) : (
          <p>Tidak ada harga jual {nu} yang perlu diisi.</p>
        )}
      </div>
    </div>
  )
}

function Table({ title, head, empty, right = [], children }: { title: string; head: string[]; empty: string; right?: number[]; children: React.ReactNode[] }) {
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="border-b border-border px-4 py-2 text-sm font-semibold text-foreground">{title}</div>
      {children.length === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                {head.map((h, i) => <th key={h} className={`px-4 py-2 font-medium ${right.includes(i) ? 'text-right' : ''}`}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="[&>tr]:border-b [&>tr]:border-border [&>tr:last-child]:border-0">{children}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Td({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) {
  return <td className={`px-4 py-2 ${right ? 'text-right whitespace-nowrap' : ''} ${bold ? 'font-medium text-foreground' : ''}`}>{children}</td>
}
