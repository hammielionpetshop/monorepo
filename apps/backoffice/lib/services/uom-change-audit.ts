// Jejak perubahan satuan produk (permintaan owner 2026-11-19, kasus TRX-20261104-2629). Sebelumnya
// hanya Ganti Satuan Dasar yang tercatat; tambah/ubah/hapus konversi dan ganti nama satuan master
// tidak meninggalkan jejak, sehingga satuan "hilang" di dokumen lama tidak bisa dilacak.

export const UOM_CONVERSION_TABLE = 'product_uom_conversions'
export const UOM_MASTER_TABLE = 'units_of_measure'

export type UomConversionAction = 'UOM_CONVERSION_ADD' | 'UOM_CONVERSION_UPDATE' | 'UOM_CONVERSION_DELETE'

export interface ConversionSnapshot {
  uomId: number
  uomCode: string | null
  ratio: number | null
  weightGram: number | null
}

interface Actor {
  userId: number | null
  branchId: number | null
}

export function buildConversionAuditEntry(params: {
  action: UomConversionAction
  productId: number
  productName: string | null
  actor: Actor
  before: ConversionSnapshot | null
  after: ConversionSnapshot | null
  extra?: Record<string, unknown>
}) {
  const { action, productId, productName, actor, before, after, extra } = params
  return {
    branchId: actor.branchId,
    userId: actor.userId,
    action,
    tableName: UOM_CONVERSION_TABLE,
    recordId: String(productId),
    oldData: before ? JSON.stringify({ productName, ...before }) : null,
    newData: after || extra ? JSON.stringify({ productName, ...(after ?? {}), ...(extra ?? {}) }) : null,
  }
}

export function buildUomMasterAuditEntry(params: {
  uomId: number
  actor: Actor
  before: { code: string; name: string; isBase: boolean }
  after: { code: string; name: string; isBase: boolean }
}) {
  return {
    branchId: params.actor.branchId,
    userId: params.actor.userId,
    action: 'UOM_MASTER_UPDATE',
    tableName: UOM_MASTER_TABLE,
    recordId: String(params.uomId),
    oldData: JSON.stringify(params.before),
    newData: JSON.stringify(params.after),
  }
}

function parse(json: string | null): Record<string, unknown> {
  if (!json) return {}
  try {
    const value = JSON.parse(json)
    return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

const text = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : String(v))

/** Kalimat ringkas satu entri riwayat satuan, untuk tab Riwayat Satuan di detail produk. */
export function describeUomHistoryEntry(entry: { action: string; oldData: string | null; newData: string | null }): string {
  const before = parse(entry.oldData)
  const after = parse(entry.newData)
  switch (entry.action) {
    case 'UOM_CONVERSION_ADD': {
      const copied =
        after.source === 'COPY' ? ` — disalin dari ${text(after.sourceProductName)}` : ''
      return `Satuan ${text(after.uomCode)} ditambahkan (1 ${text(after.uomCode)} = ${text(after.ratio)} satuan dasar)${copied}`
    }
    case 'UOM_CONVERSION_UPDATE': {
      const parts: string[] = []
      if (before.ratio !== after.ratio) parts.push(`isi ${text(before.ratio)} → ${text(after.ratio)}`)
      if (before.weightGram !== after.weightGram) {
        parts.push(`berat ${text(before.weightGram)} g → ${text(after.weightGram)} g`)
      }
      return `Satuan ${text(before.uomCode ?? after.uomCode)} diubah: ${parts.length > 0 ? parts.join(', ') : 'tanpa perubahan nilai'}`
    }
    case 'UOM_CONVERSION_DELETE': {
      const removed =
        Number(after.deletedPrices ?? 0) > 0 || Number(after.deletedCosts ?? 0) > 0
          ? `; ikut terhapus ${text(after.deletedPrices ?? 0)} harga jual & ${text(after.deletedCosts ?? 0)} modal`
          : ''
      return `Satuan ${text(before.uomCode)} dihapus (dulu 1 ${text(before.uomCode)} = ${text(before.ratio)} satuan dasar)${removed}`
    }
    case 'BASE_UOM_CHANGE':
      return `Satuan dasar diganti ${text(before.baseUomCode)} → ${text(after.baseUomCode)} (1 ${text(before.baseUomCode)} = ${text(after.ratio)} ${text(after.baseUomCode)})`
    case 'UOM_MASTER_UPDATE': {
      const parts: string[] = []
      if (before.name !== after.name) parts.push(`nama "${text(before.name)}" → "${text(after.name)}"`)
      if (before.code !== after.code) parts.push(`kode ${text(before.code)} → ${text(after.code)}`)
      if (before.isBase !== after.isBase) parts.push(after.isBase ? 'ditandai satuan dasar' : 'tidak lagi satuan dasar')
      return `Master Satuan Ukur ${text(before.code)} diubah (berlaku untuk semua produk): ${parts.length > 0 ? parts.join(', ') : 'tanpa perubahan nilai'}`
    }
    default:
      return entry.action
  }
}
