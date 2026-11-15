import { sql } from 'drizzle-orm';
import { check, integer, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { hrisSchema } from './shared';

// Berkas terlindungi (spec L2f-1 §2.1). Isinya di volume UPLOAD_DIR yang tidak punya alamat publik;
// hanya keluar lewat route HRIS yang memeriksa hak. Tidak ada hapus.
export const files = hrisSchema.table(
  'files',
  {
    id: uuid('id').primaryKey(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    sha256: text('sha256').notNull(),
    uploadedByAccountId: integer('uploaded_by_account_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check('files_mime_allowed', sql`${t.mime} in ('image/jpeg', 'image/png', 'image/webp')`),
    check('files_size_range', sql`${t.sizeBytes} between 1 and 10485760`),
  ],
);
