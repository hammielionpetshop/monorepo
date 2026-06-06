import pg from 'pg'
const { Client } = pg

// ─── Config ───────────────────────────────────────────────────────────────────
const BASE      = { host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432 }
const OLD_DB    = { ...BASE, database: 'hammielion_db' }
const NEW_DB    = { ...BASE, database: 'petshop_db' }
const OLD_SCHEMA = 'public'
const NEW_SCHEMA = 'petshop'
const BRANCH_ID  = 1
const TOKO_PUSAT = 'a43c474c-7601-4ed4-acc8-13a965e35e2e'

const TIER_MAP = {
  RETAIL:    'RETAIL',
  TOKO:      'RETAIL',
  GROSIR:    'GROSIR',
  GROSIRB:   'GROSIR',
  WHOLESALE: 'GROSIR',
  MIX:       'RESELLER',
  MEMBER:    'MEMBER',
  PARETO:    'DISTRIBUTOR',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function log(msg)      { console.log(`  ${msg}`) }
function step(msg)     { console.log(`\n▶ ${msg}`) }
function ok(msg)       { console.log(`  ✓ ${msg}`) }
function warn(msg)     { console.log(`  ⚠ ${msg}`) }

async function truncateTables(client) {
  // reverse FK order
  const tables = [
    'product_prices',
    'product_uom_conversions',
    'products',
    'categories',
    'units_of_measure',
  ]
  for (const t of tables) {
    await client.query(`TRUNCATE TABLE ${NEW_SCHEMA}.${t} RESTART IDENTITY CASCADE`)
  }
}

// ─── Migration steps ──────────────────────────────────────────────────────────

async function migrateCategories(oldClient, newClient) {
  step('Migrating categories...')
  const { rows } = await oldClient.query(`
    SELECT id, name FROM ${OLD_SCHEMA}.category
    WHERE deleted_at IS NULL
    ORDER BY name
  `)

  const idMap = {} // old UUID → new int
  let count = 0

  for (const row of rows) {
    const res = await newClient.query(`
      INSERT INTO ${NEW_SCHEMA}.categories (name)
      VALUES ($1)
      RETURNING id
    `, [row.name])
    idMap[row.id] = res.rows[0].id
    count++
  }

  ok(`${count} categories migrated`)
  return idMap
}

async function migrateUOM(oldClient, newClient) {
  step('Migrating units_of_measure...')
  const { rows } = await oldClient.query(`
    SELECT id, code, name FROM ${OLD_SCHEMA}.uom
    WHERE deleted_at IS NULL
    ORDER BY code
  `)

  const idMap = {}
  let count = 0

  for (const row of rows) {
    const res = await newClient.query(`
      INSERT INTO ${NEW_SCHEMA}.units_of_measure (code, name, is_base)
      VALUES ($1, $2, false)
      RETURNING id
    `, [row.code, row.name])
    idMap[row.id] = res.rows[0].id
    count++
  }

  ok(`${count} units_of_measure migrated`)
  return idMap
}

async function migrateProducts(oldClient, newClient, catIdMap, uomIdMap) {
  step('Migrating products...')

  // Get all active products
  const { rows: products } = await oldClient.query(`
    SELECT id, sku, name, category_id, unit, weight, is_active
    FROM ${OLD_SCHEMA}.product
    WHERE deleted_at IS NULL AND is_active = true
    ORDER BY name
  `)

  // Get base UOM per product (product_uom where is_base_unit = true)
  const { rows: baseUoms } = await oldClient.query(`
    SELECT pu.product_id, pu.uom_id
    FROM ${OLD_SCHEMA}.product_uom pu
    WHERE pu.is_base_unit = true AND pu.deleted_at IS NULL
  `)
  const baseUomByProduct = {}
  baseUoms.forEach(r => { baseUomByProduct[r.product_id] = r.uom_id })

  // Also get UOM by code from old DB (includes deleted — for fallback lookup)
  const { rows: oldUomRows } = await oldClient.query(`SELECT id, code FROM ${OLD_SCHEMA}.uom`)
  const uomByCode = {}
  oldUomRows.forEach(r => { uomByCode[r.code.trim().toUpperCase()] = r.id })

  // Direct code→newId from new DB (safest fallback, bypasses UUID mapping)
  const { rows: newUomRows } = await newClient.query(`SELECT id, code FROM ${NEW_SCHEMA}.units_of_measure`)
  const newUomByCode = {}
  newUomRows.forEach(r => { newUomByCode[r.code.trim().toUpperCase()] = r.id })

  const idMap = {}
  let count = 0
  let skipped = 0
  let fallback = 0

  for (const p of products) {
    // Resolve base_uom_id
    let oldUomId = baseUomByProduct[p.id]
    if (!oldUomId) {
      // fallback: match by unit code on the product row (case-insensitive)
      oldUomId = uomByCode[p.unit?.trim().toUpperCase()]
      if (oldUomId) fallback++
    }

    // Resolve new UOM id: try idMap first, then direct code lookup in new DB
    let newUomId = uomIdMap[oldUomId]
    if (!newUomId) {
      // fallback: find by UOM code directly in new DB
      const oldUomCode = oldUomRows.find(r => r.id === oldUomId)?.code
      if (oldUomCode) newUomId = newUomByCode[oldUomCode.trim().toUpperCase()]
    }
    if (!newUomId) {
      // last resort: match product.unit code directly in new DB
      newUomId = newUomByCode[p.unit?.trim().toUpperCase()]
    }
    if (!newUomId) {
      warn(`Skipping product "${p.name}" — UOM "${p.unit}" not found in new DB`)
      skipped++
      continue
    }

    const newCatId = p.category_id ? catIdMap[p.category_id] ?? null : null
    const weightGram = p.weight ? Math.round(parseFloat(p.weight)) : null

    const res = await newClient.query(`
      INSERT INTO ${NEW_SCHEMA}.products
        (sku, name, category_id, brand_id, base_uom_id, is_active, weight_gram)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (sku) DO NOTHING
      RETURNING id
    `, [p.sku, p.name, newCatId, null, newUomId, p.is_active, weightGram])

    // ON CONFLICT DO NOTHING returns no rows — fetch existing id
    if (!res.rows.length) {
      const existing = await newClient.query(
        `SELECT id FROM ${NEW_SCHEMA}.products WHERE sku = $1`, [p.sku]
      )
      if (existing.rows.length) {
        idMap[p.id] = existing.rows[0].id
      }
      skipped++
      continue
    }

    idMap[p.id] = res.rows[0].id
    count++
  }

  ok(`${count} products migrated  (${skipped} skipped, ${fallback} used unit-code fallback)`)
  return idMap
}

async function migrateUOMConversions(oldClient, newClient, productIdMap, uomIdMap) {
  step('Migrating product_uom_conversions...')

  const { rows } = await oldClient.query(`
    SELECT pu.product_id, pu.uom_id, pu.conversion_factor
    FROM ${OLD_SCHEMA}.product_uom pu
    JOIN ${OLD_SCHEMA}.product p ON p.id = pu.product_id
    WHERE pu.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND p.is_active = true
      AND pu.is_base_unit = false
    ORDER BY pu.product_id
  `)

  let count = 0
  let skipped = 0

  for (const row of rows) {
    const newProductId = productIdMap[row.product_id]
    const newUomId     = uomIdMap[row.uom_id]

    if (!newProductId || !newUomId) {
      skipped++
      continue
    }

    const ratio = Math.round(parseFloat(row.conversion_factor))
    if (ratio <= 0) { skipped++; continue }

    await newClient.query(`
      INSERT INTO ${NEW_SCHEMA}.product_uom_conversions (product_id, uom_id, ratio)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [newProductId, newUomId, ratio])

    count++
  }

  ok(`${count} UOM conversions migrated  (${skipped} skipped)`)
}

async function migrateProductPrices(oldClient, newClient, productIdMap, uomIdMap) {
  step('Migrating product_prices (TOKO PUSAT only, price > 0)...')

  const { rows } = await oldClient.query(`
    SELECT s.product_id, s.uom_id, s.price_category_id, MAX(s.price) as price
    FROM ${OLD_SCHEMA}.store_product_uom_price s
    JOIN ${OLD_SCHEMA}.product p ON p.id = s.product_id
    WHERE s.store_id = $1
      AND s.deleted_at IS NULL
      AND s.price > 0
      AND p.deleted_at IS NULL
      AND p.is_active = true
    GROUP BY s.product_id, s.uom_id, s.price_category_id
    ORDER BY s.product_id
  `, [TOKO_PUSAT])

  let count = 0
  let skipped = 0
  const tierCount = {}

  for (const row of rows) {
    const newProductId = productIdMap[row.product_id]
    const newUomId     = uomIdMap[row.uom_id]
    const tierType     = TIER_MAP[row.price_category_id]

    if (!newProductId || !newUomId || !tierType) {
      skipped++
      continue
    }

    const price = Math.round(parseFloat(row.price))

    await newClient.query(`
      INSERT INTO ${NEW_SCHEMA}.product_prices
        (product_id, branch_id, uom_id, tier_type, price)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [newProductId, BRANCH_ID, newUomId, tierType, price])

    tierCount[tierType] = (tierCount[tierType] || 0) + 1
    count++
  }

  ok(`${count} product_prices migrated  (${skipped} skipped)`)
  log(`   Breakdown: ${Object.entries(tierCount).map(([t,c]) => `${t}=${c}`).join(', ')}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  const oldClient = new Client(OLD_DB)
  const newClient = new Client(NEW_DB)

  try {
    console.log('\n' + '═'.repeat(55))
    console.log('  PRODUCT MIGRATION')
    console.log('  hammielion_db.public  →  petshop_db.petshop')
    console.log('═'.repeat(55))

    await oldClient.connect()
    await newClient.connect()
    log('Connected to both databases')

    // Warn about truncate
    console.log('')
    warn('Akan TRUNCATE tabel berikut di petshop_db:')
    warn('  product_prices, product_uom_conversions, products, categories, units_of_measure')
    console.log('')

    step('Truncating target tables...')
    await truncateTables(newClient)
    ok('Tables truncated')

    // Run migrations (no transaction wrapper — easier to debug per step)
    const catIdMap     = await migrateCategories(oldClient, newClient)
    const uomIdMap     = await migrateUOM(oldClient, newClient)
    const productIdMap = await migrateProducts(oldClient, newClient, catIdMap, uomIdMap)
    await migrateUOMConversions(oldClient, newClient, productIdMap, uomIdMap)
    await migrateProductPrices(oldClient, newClient, productIdMap, uomIdMap)

    // Verify counts
    step('Verifying row counts in new DB...')
    const tables = ['categories', 'units_of_measure', 'products', 'product_uom_conversions', 'product_prices']
    for (const t of tables) {
      const { rows } = await newClient.query(`SELECT COUNT(*) FROM ${NEW_SCHEMA}.${t}`)
      log(`${t.padEnd(28)} ${rows[0].count} rows`)
    }

    console.log('\n' + '═'.repeat(55))
    console.log('  MIGRATION COMPLETE')
    console.log('═'.repeat(55) + '\n')

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message)
    console.error(err.stack)
    process.exit(1)
  } finally {
    await oldClient.end()
    await newClient.end()
  }
}

main()
