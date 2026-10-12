import type { AnyColumn } from 'drizzle-orm'
import { db, appSettings, auditLogs, eq, sql } from '@/lib/db'
import { FREE_SHIPPING_SETTING_KEY, parseFreeShippingValue, validateFreeShippingValue } from './ongkir'

// Bagian server mesin ongkir (lihat lib/ongkir.ts): pengaturan nilai gratis ongkir dan data
// penanda ongkir untuk cetak ulang struk.

type Executor = Pick<typeof db, 'select'>

export async function getFreeShippingValue(executor: Executor = db): Promise<number> {
  const [row] = await executor
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, FREE_SHIPPING_SETTING_KEY))
    .limit(1)
  return parseFreeShippingValue(row?.value)
}

export class FreeShippingSettingError extends Error {}

/** Ubah nilai gratis ongkir (Owner/GM). Berjejak di audit_logs; nota lama tidak berubah. */
export async function setFreeShippingValue(value: number, actor: { userId: number; branchId: number }): Promise<number> {
  const problem = validateFreeShippingValue(value)
  if (problem) throw new FreeShippingSettingError(problem)
  return db.transaction(async (tx) => {
    const old = await getFreeShippingValue(tx)
    if (old === value) return value
    await tx
      .insert(appSettings)
      .values({ key: FREE_SHIPPING_SETTING_KEY, value: String(value), updatedBy: actor.userId, updatedAt: new Date() })
      .onConflictDoUpdate({ target: appSettings.key, set: { value: String(value), updatedBy: actor.userId, updatedAt: new Date() } })
    await tx.insert(auditLogs).values({
      branchId: actor.branchId, userId: actor.userId, action: 'FREE_SHIPPING_VALUE_UPDATE', tableName: 'app_settings',
      recordId: FREE_SHIPPING_SETTING_KEY, oldData: JSON.stringify({ value: old }), newData: JSON.stringify({ value }),
    })
    return value
  })
}

/** TRUE bila baris nota ini ongkir gratis (dipakai saat memuat nota untuk cetak ulang struk). */
export function freeShippingOfItemSql(transactionItemId: AnyColumn) {
  return sql<boolean>`EXISTS (
    SELECT 1 FROM petshop.service_deliveries sd
    WHERE sd.transaction_item_id = ${transactionItemId} AND sd.is_free_shipping
  )`
}
