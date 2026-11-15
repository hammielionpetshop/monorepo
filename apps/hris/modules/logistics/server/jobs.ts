import { sql } from 'drizzle-orm';
import { photoPurges } from '@petshop/logistics';
import { db } from '@/lib/db';
import { removeStoredBytes } from '@/modules/files';
import { settingOn } from '@/modules/settings';
import { addDays, wibDate } from '../rules/trip';
import { notifyHanging } from './trips';

/**
 * Mesin harian Logistik (spec L6 §6), 12.05 WIB, aman diulang: trip menggantung diberitahukan sekali (LOG-31), lalu isi foto
 * awak dan foto tutup kantor lewat masa simpan foto absen dibuang (KEH-15). Foto nota supplier disimpan (bukti upah belanja).
 */
export async function runLogisticsDaily(now: Date = new Date()) {
  const today = wibDate(now);
  const hour = await settingOn<number>('logistics.hanging_hour', today);
  const hanging = await notifyHanging(now, hour);
  const days = await settingOn<number>('attendance.photo_retention_days', today);
  const before = new Date(`${addDays(today, -days)}T00:00:00+07:00`);
  const rows = await db.execute<{ file_id: string }>(sql`
    select f.file_id from (
      select crew_photo_file_id as file_id, departed_at as at from logistics.trips where crew_photo_file_id is not null
      union all select office_close_photo_file_id, finished_at from logistics.trips where office_close_photo_file_id is not null
    ) f
    where f.at < ${before.toISOString()}::timestamptz and not exists (select 1 from logistics.photo_purges p where p.file_id = f.file_id)
    limit 2000`);
  for (const { file_id: fileId } of rows) {
    await removeStoredBytes(fileId);
    await db.insert(photoPurges).values({ fileId }).onConflictDoNothing();
  }
  return { hanging, purged: rows.length };
}
