import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import postgres from 'postgres';

/**
 * Klon data MASTER (non-transaksional) dari produksi ke database LOKAL.
 *
 * Sumber  : URL di `.env` root — dibaca langsung dari file, dan HANYA di-SELECT.
 * Tujuan  : process.env.DATABASE_URL — wajib host lokal (dipasang scripts/with-local-db.mjs).
 *
 * Yang TIDAK diklon, dengan sengaja:
 * - `users`, `owner_assignments`, `user_permissions` — berisi hash PIN/password staf asli.
 *   Materi kredensial tidak dibawa ke mesin dev, lagipula PIN-nya tak diketahui sehingga
 *   tak bisa dipakai login. User uji dibuat `local-fixtures.ts` dengan PIN yang diketahui.
 * - Seluruh state inventori & transaksional (stok, batch, transaksi, shift, opname, audit).
 *   Stok produksi sedang minus hampir menyeluruh; menyalinnya membuat setiap pengujian
 *   berangkat dari angka yang sudah salah. `local-fixtures.ts` mengisi stok bersih.
 *
 * Kolom dibaca dari information_schema, bukan didaftar manual, supaya skema yang berubah
 * tidak diam-diam membuat klon kehilangan kolom.
 */
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

// Urut sesuai ketergantungan foreign key — induk sebelum anak.
const MASTER_TABLES = [
  'branches',
  'roles',
  'permissions',
  'role_permissions',
  'units_of_measure',
  'categories',
  'brands',
  'suppliers',
  'customers',
  'payment_methods',
  'expense_categories',
  'app_settings',
  'promotions',
  'products',
  'product_barcodes',
  'product_uom_conversions',
  'product_prices',
  'product_uom_costs',
] as const;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);
const CHUNK_SIZE = 500;

function readProductionUrl(): string {
  const envPath = path.resolve(process.cwd(), '../../.env');
  const raw = fs.readFileSync(envPath, 'utf8');
  const match = raw.match(/^\s*DATABASE_URL=(.+)$/m);
  if (!match) throw new Error(`DATABASE_URL tidak ditemukan di ${envPath}`);
  return match[1].trim();
}

async function main() {
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) throw new Error('DATABASE_URL (tujuan) tidak diset');

  const targetHost = new URL(targetUrl).hostname;
  if (!LOCAL_HOSTS.has(targetHost)) {
    console.error(`❌ Dibatalkan: tujuan klon "${targetHost}" bukan database lokal.`);
    console.error('   Skrip ini menulis banyak baris; jangan pernah diarahkan ke server.');
    process.exit(1);
  }

  const sourceUrl = readProductionUrl();
  const sourceHost = new URL(sourceUrl).hostname;
  if (sourceHost === targetHost) {
    console.error('❌ Dibatalkan: sumber dan tujuan menunjuk host yang sama.');
    process.exit(1);
  }

  console.log(`🐘 Klon master: ${sourceHost} → ${targetHost}\n`);

  const source = postgres(sourceUrl, { max: 4, idle_timeout: 20 });
  // onnotice diredam: TRUNCATE ... CASCADE membanjiri log dengan NOTICE untuk tiap
  // tabel anak yang ikut dikosongkan, padahal di DB kosong semuanya memang nihil.
  const target = postgres(targetUrl, { max: 4, idle_timeout: 20, onnotice: () => {} });

  let totalRows = 0;

  try {
    for (const table of MASTER_TABLES) {
      const columnRows = await target`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'petshop' AND table_name = ${table}
        ORDER BY ordinal_position
      `;
      if (columnRows.length === 0) {
        console.log(`   ⚠ ${table.padEnd(26)} tidak ada di tujuan — dilewati`);
        continue;
      }
      const columns = columnRows.map((c) => c.column_name as string);

      const rows = await source`
        SELECT ${source(columns)} FROM petshop.${source(table)}
      `;

      // Tujuan dibangun dari nol, tapi tetap dikosongkan agar skrip aman diulang.
      await target`TRUNCATE petshop.${target(table)} CASCADE`;

      for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
        const chunk = rows.slice(i, i + CHUNK_SIZE);
        await target`INSERT INTO petshop.${target(table)} ${target(chunk, columns)}`;
      }

      // Sequence ikut dimajukan; tanpa ini INSERT berikutnya bentrok primary key.
      if (columns.includes('id')) {
        await target`
          SELECT setval(
            pg_get_serial_sequence('petshop.' || ${table}, 'id'),
            GREATEST((SELECT COALESCE(MAX(id), 1) FROM petshop.${target(table)}), 1)
          )
        `;
      }

      totalRows += rows.length;
      console.log(`   ✓ ${table.padEnd(26)} ${String(rows.length).padStart(6)} baris`);
    }

    console.log(`\n✅ Selesai — ${totalRows.toLocaleString('id-ID')} baris master terklon.`);
    console.log('   Tidak diklon: users, stok, dan seluruh data transaksional (lihat komentar di berkas ini).');
  } finally {
    await source.end();
    await target.end();
  }

  process.exit(0);
}

main().catch((err) => {
  console.error('❌ Klon master gagal:');
  console.error(err);
  process.exit(1);
});
