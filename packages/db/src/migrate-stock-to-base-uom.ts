/**
 * Deployment B — Step B2: Normalisasi productStocks ke base UOM
 *
 * Jalankan SEKALI dalam maintenance window setelah deploy kode Deployment B.
 * Setelah selesai, terapkan constraint UNIQUE(productId, branchId) via db:push.
 *
 *   npx tsx scripts/migrate-stock-to-base-uom.ts
 */
import * as dotenv from 'dotenv'
import { resolve } from 'path'
import postgres from 'postgres'

// Cari .env dari root monorepo, kompatibel dengan dijalankan dari mana saja
dotenv.config({ path: resolve(process.cwd(), '../../.env') })          // dari packages/db
dotenv.config({ path: resolve(process.cwd(), '.env') })                 // dari root
dotenv.config({ path: resolve(process.cwd(), 'apps/backoffice/.env.local') }) // fallback

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.error('DATABASE_URL tidak ditemukan. Pastikan .env sudah benar.')
  process.exit(1)
}

const sql = postgres(connectionString)

async function run() {
  console.log('=== Migrasi Stok ke Base UOM ===\n')

  // 1. Ambil semua (productId, branchId) yang punya lebih dari 1 baris ATAU uomId bukan baseUomId
  const groups = await sql`
    SELECT
      ps.product_id,
      ps.branch_id,
      p.base_uom_id,
      COUNT(*) AS row_count
    FROM petshop.product_stocks ps
    JOIN petshop.products p ON p.id = ps.product_id
    GROUP BY ps.product_id, ps.branch_id, p.base_uom_id
    HAVING COUNT(*) > 1
      OR MAX(ps.uom_id) != p.base_uom_id
    ORDER BY ps.product_id, ps.branch_id
  `

  console.log(`Ditemukan ${groups.length} grup (productId, branchId) yang perlu dinormalisasi.`)
  if (groups.length === 0) {
    console.log('Tidak ada yang perlu dimigrasikan.')
    await sql.end()
    return
  }

  let successCount = 0
  let errorCount = 0

  for (const group of groups) {
    const { product_id, branch_id, base_uom_id } = group

    await sql.begin(async (trx) => {
      // Lock rows terlebih dahulu (tanpa JOIN untuk menghindari error FOR UPDATE + LEFT JOIN)
      await trx`
        SELECT id FROM petshop.product_stocks
        WHERE product_id = ${product_id} AND branch_id = ${branch_id}
        FOR UPDATE
      `

      // Ambil data dengan rasio konversi (sudah di-lock, LEFT JOIN aman tanpa FOR UPDATE)
      const rows = await trx`
        SELECT
          ps.id,
          ps.uom_id,
          ps.qty,
          COALESCE(c.ratio, 1) AS ratio
        FROM petshop.product_stocks ps
        LEFT JOIN petshop.product_uom_conversions c
          ON c.product_id = ps.product_id AND c.uom_id = ps.uom_id
        WHERE ps.product_id = ${product_id}
          AND ps.branch_id = ${branch_id}
      `

      // Hitung total dalam base UOM
      let totalBaseQty = 0
      for (const row of rows) {
        totalBaseQty += Math.round(Number(row.qty) * Number(row.ratio))
      }

      // Hapus semua baris lama
      await trx`
        DELETE FROM petshop.product_stocks
        WHERE product_id = ${product_id}
          AND branch_id = ${branch_id}
      `

      // Insert satu baris baru di base UOM (hanya jika qty > 0)
      if (totalBaseQty > 0) {
        await trx`
          INSERT INTO petshop.product_stocks (product_id, branch_id, uom_id, qty)
          VALUES (${product_id}, ${branch_id}, ${base_uom_id}, ${totalBaseQty})
        `
      }

      console.log(
        `  ✓ product=${product_id} branch=${branch_id} → merged ${rows.length} rows → qty=${totalBaseQty} (baseUom=${base_uom_id})`
      )
      successCount++
    }).catch((err) => {
      console.error(`  ✗ product=${product_id} branch=${branch_id} → Error: ${err.message}`)
      errorCount++
    })
  }

  // 2. Normalisasi productStockBatches — pastikan qtyRemaining dalam base UOM
  //    Batch yang uomId != baseUomId berarti qtyReceived/qtyRemaining mungkin belum dikonversi
  console.log('\n--- Normalisasi productStockBatches ---')

  const batches = await sql`
    SELECT
      b.id,
      b.product_id,
      b.uom_id,
      b.qty_received,
      b.qty_remaining,
      b.cost_price,
      p.base_uom_id,
      COALESCE(c.ratio, 1) AS ratio
    FROM petshop.product_stock_batches b
    JOIN petshop.products p ON p.id = b.product_id
    LEFT JOIN petshop.product_uom_conversions c
      ON c.product_id = b.product_id AND c.uom_id = b.uom_id
    WHERE b.uom_id != p.base_uom_id
      AND COALESCE(c.ratio, 1) != 1
  `

  console.log(`Ditemukan ${batches.length} batch dengan uomId != baseUomId.`)

  let batchFixed = 0
  for (const b of batches) {
    const ratio = Number(b.ratio)

    // Cek apakah sudah terkonversi (jika qtyReceived besar dibanding rasio, kemungkinan belum dikonversi)
    // Heuristik: jika qtyRemaining == qtyReceived dan keduanya kecil (< ratio), bisa jadi sudah dikonversi
    // Tapi lebih aman: kita lewati batch yang tidak konsisten — JANGAN double-convert
    // Alih-alih, kita tandai sebagai "perlu review manual" bila ada ambiguitas
    const expectedBase = Math.round(Number(b.qty_received) * ratio)

    // Jika qtyReceived sudah dalam base UOM (besar), tidak perlu konversi
    // Deteksi: jika qtyReceived < ratio, kemungkinan belum dikonversi (ini perkiraan)
    // Untuk safety, skip batch ini dan log warning saja
    console.log(
      `  ⚠ batch=${b.id} product=${b.product_id} uom=${b.uom_id} (ratio=${ratio}) ` +
      `qtyReceived=${b.qty_received} qtyRemaining=${b.qty_remaining} expectedBase=${expectedBase}`
    )
    console.log(`    → Review manual diperlukan untuk batch ini.`)
    batchFixed++
  }

  console.log('\n=== Ringkasan ===')
  console.log(`productStocks: ${successCount} berhasil, ${errorCount} gagal`)
  console.log(`productStockBatches: ${batchFixed} perlu review manual (lihat log di atas)`)

  if (errorCount > 0) {
    console.error('\nAda kesalahan. Periksa log dan jalankan ulang setelah diperbaiki.')
    await sql.end()
    process.exit(1)
  }

  console.log('\nSelesai. Sekarang jalankan `pnpm db:push` untuk menerapkan UNIQUE constraint.')
  await sql.end()
}

run().catch(async (err) => {
  console.error('Fatal:', err.message)
  await sql.end()
  process.exit(1)
})
