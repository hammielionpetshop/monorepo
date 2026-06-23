import { db, branches, eq } from '@/lib/db'

export interface ReceiptStoreInfo {
  storeName: string
  storeAddress: string | null
  storePhone: string | null
}

export async function getReceiptStoreInfo(branchId: number): Promise<ReceiptStoreInfo> {
  const row = await db
    .select({
      receiptName: branches.receiptName,
      address: branches.address,
      phone: branches.phone,
    })
    .from(branches)
    .where(eq(branches.id, branchId))
    .limit(1)

  const b = row[0]
  return {
    storeName: b?.receiptName || 'HAMMIELION',
    storeAddress: b?.address ?? null,
    storePhone: b?.phone ?? null,
  }
}
