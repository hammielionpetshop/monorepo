import pg from 'pg'
const { Client } = pg

const TOKO_PUSAT_ID = 'a43c474c-7601-4ed4-acc8-13a965e35e2e'

const TIER_MAP = {
  RETAIL: 'RETAIL',
  TOKO: 'RETAIL',
  GROSIR: 'GROSIR',
  GROSIRB: 'GROSIR',
  WHOLESALE: 'GROSIR',
  MIX: 'RESELLER',
  MEMBER: 'MEMBER',
  PARETO: 'DISTRIBUTOR',
}

async function main() {
  const o = new Client({ host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432, database: 'hammielion_db' })
  await o.connect()

  const [cat, uom, prod, puom, prices, zeroPrice, tierBreak, dupCheck] = await Promise.all([
    o.query(`SELECT COUNT(*) FROM public.category WHERE deleted_at IS NULL`),
    o.query(`SELECT COUNT(*) FROM public.uom WHERE deleted_at IS NULL`),
    o.query(`SELECT COUNT(*) FROM public.product WHERE deleted_at IS NULL AND is_active = true`),
    o.query(`
      SELECT COUNT(*) FROM public.product_uom pu
      JOIN public.product p ON p.id = pu.product_id
      WHERE pu.deleted_at IS NULL AND p.deleted_at IS NULL
        AND p.is_active = true AND pu.is_base_unit = false
    `),
    o.query(`
      SELECT COUNT(*) FROM public.store_product_uom_price
      WHERE store_id = $1 AND deleted_at IS NULL AND price > 0
    `, [TOKO_PUSAT_ID]),
    o.query(`
      SELECT COUNT(DISTINCT product_id) FROM public.store_product_uom_price
      WHERE store_id = $1 AND deleted_at IS NULL AND price = 0
    `, [TOKO_PUSAT_ID]),
    o.query(`
      SELECT price_category_id, COUNT(*) as cnt
      FROM public.store_product_uom_price
      WHERE store_id = $1 AND deleted_at IS NULL AND price > 0
      GROUP BY price_category_id ORDER BY cnt DESC
    `, [TOKO_PUSAT_ID]),
    o.query(`
      SELECT COUNT(*) FROM (
        SELECT product_id, uom_id, price_category_id
        FROM public.store_product_uom_price
        WHERE store_id = $1 AND deleted_at IS NULL AND price > 0
        GROUP BY product_id, uom_id, price_category_id
        HAVING COUNT(*) > 1
      ) t
    `, [TOKO_PUSAT_ID]),
  ])

  // After consolidation, how many unique rows?
  const afterConsolidate = await o.query(`
    SELECT COUNT(*) FROM (
      SELECT product_id, uom_id, $1 as tier
      FROM public.store_product_uom_price s
      WHERE store_id = $2 AND deleted_at IS NULL AND price > 0
      GROUP BY product_id, uom_id, tier
    ) t
  `, [Object.keys(TIER_MAP).map(k => TIER_MAP[k]).join(','), TOKO_PUSAT_ID])

  // More accurate: count per mapped tier
  const consolidatedTiers = await o.query(`
    SELECT price_category_id, COUNT(*) as cnt
    FROM public.store_product_uom_price
    WHERE store_id = $1 AND deleted_at IS NULL AND price > 0
    GROUP BY price_category_id
  `, [TOKO_PUSAT_ID])

  const tierResult = {}
  consolidatedTiers.rows.forEach(r => {
    const mapped = TIER_MAP[r.price_category_id] || r.price_category_id
    tierResult[mapped] = (tierResult[mapped] || 0) + parseInt(r.cnt)
  })

  console.log('')
  console.log('═'.repeat(55))
  console.log('  PREVIEW HASIL MIGRASI')
  console.log('═'.repeat(55))
  console.log('')
  console.log('  Tabel              Sebelum    Sesudah')
  console.log('  ' + '─'.repeat(45))
  console.log(`  categories         ${String(cat.rows[0].count).padStart(7)}    → masuk semua`)
  console.log(`  units_of_measure   ${String(uom.rows[0].count).padStart(7)}    → masuk semua`)
  console.log(`  products           ${String(prod.rows[0].count).padStart(7)}    → masuk semua (active)`)
  console.log(`  uom_conversions    ${String(puom.rows[0].count).padStart(7)}    → masuk semua (non-base)`)
  console.log(`  product_prices     ${String(prices.rows[0].count).padStart(7)}    → setelah konsolidasi tier:`)
  console.log('')
  console.log('  Breakdown tier SEBELUM konsolidasi (TOKO PUSAT, price > 0):')
  tierBreak.rows.forEach(r => {
    const mapped = TIER_MAP[r.price_category_id] || '???'
    console.log(`    ${r.price_category_id.padEnd(12)} ${String(r.cnt).padStart(5)} rows  →  ${mapped}`)
  })
  console.log('')
  console.log('  Breakdown tier SESUDAH konsolidasi:')
  Object.entries(tierResult).sort((a,b) => b[1]-a[1]).forEach(([t, cnt]) => {
    console.log(`    ${t.padEnd(12)} ${String(cnt).padStart(5)} rows`)
  })
  console.log('')
  console.log('  Catatan:')
  console.log(`    - ${zeroPrice.rows[0].count} produk punya harga 0 → di-skip`)
  console.log(`    - ${dupCheck.rows[0].count} duplikat product+uom+tier → akan diambil MAX(price)`)
  console.log('')
  console.log('═'.repeat(55))

  await o.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
