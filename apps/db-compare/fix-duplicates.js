import pg from 'pg'
const { Client } = pg

const BASE     = { host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432 }
const TOKO_PUSAT = 'a43c474c-7601-4ed4-acc8-13a965e35e2e'
const BRANCH_ID  = 1
const DUP_SKUS   = ['1821022500212', '2702506020022', 'A48']

const TIER_MAP = {
  RETAIL: 'RETAIL', TOKO: 'RETAIL',
  GROSIR: 'GROSIR', GROSIRB: 'GROSIR', WHOLESALE: 'GROSIR',
  MIX: 'RESELLER', MEMBER: 'MEMBER', PARETO: 'DISTRIBUTOR',
}

async function main() {
  const oldClient = new Client({ ...BASE, database: 'hammielion_db' })
  const newClient = new Client({ ...BASE, database: 'petshop_db' })
  await oldClient.connect()
  await newClient.connect()

  // Get all duplicate-SKU products, skipped ones are rn > 1
  const { rows: prods } = await oldClient.query(`
    SELECT p.id, p.sku, p.name, p.unit, p.category_id, p.weight,
           ROW_NUMBER() OVER (PARTITION BY p.sku ORDER BY p.created_at ASC) as rn
    FROM public.product p
    WHERE p.deleted_at IS NULL AND p.is_active = true
      AND p.sku = ANY($1)
    ORDER BY p.sku, p.created_at
  `, [DUP_SKUS])

  const skipped = prods.filter(r => parseInt(r.rn) > 1)

  console.log('\n=== PRODUK YANG AKAN DIFIX ===')
  skipped.forEach(p => console.log(` SKU lama: ${p.sku}  |  Nama: ${p.name}`))

  // Build lookup maps from new DB
  const { rows: newUomRows } = await newClient.query(`SELECT id, code FROM petshop.units_of_measure`)
  const newUomByCode = {}
  newUomRows.forEach(r => { newUomByCode[r.code.trim().toUpperCase()] = r.id })

  const { rows: newCatRows } = await newClient.query(`SELECT id, name FROM petshop.categories`)

  // Also need old category names
  const { rows: oldCatRows } = await oldClient.query(`SELECT id, name FROM public.category WHERE deleted_at IS NULL`)
  const oldCatById = {}
  oldCatRows.forEach(r => { oldCatById[r.id] = r.name })

  const newCatByName = {}
  newCatRows.forEach(r => { newCatByName[r.name.trim().toLowerCase()] = r.id })

  // Get base UOM for skipped products
  const skippedIds = skipped.map(p => p.id)
  const { rows: baseUoms } = await oldClient.query(`
    SELECT pu.product_id, u.code as uom_code
    FROM public.product_uom pu
    JOIN public.uom u ON u.id = pu.uom_id
    WHERE pu.product_id = ANY($1) AND pu.is_base_unit = true AND pu.deleted_at IS NULL
  `, [skippedIds])
  const baseUomByProduct = {}
  baseUoms.forEach(r => { baseUomByProduct[r.product_id] = r.uom_code })

  // Insert skipped products with suffix on SKU
  console.log('\n=== INSERTING FIXED PRODUCTS ===')
  const insertedMap = {} // old id → new id

  for (const p of skipped) {
    const uomCode   = baseUomByProduct[p.id] || p.unit
    const newUomId  = newUomByCode[uomCode?.trim().toUpperCase()]
    const oldCatName = p.category_id ? oldCatById[p.category_id] : null
    const newCatId   = oldCatName ? (newCatByName[oldCatName.trim().toLowerCase()] ?? null) : null
    const weightGram = p.weight ? Math.round(parseFloat(p.weight)) : null

    // Generate new unique SKU: original + suffix -2, -3, etc.
    const suffix = parseInt(p.rn) - 1
    const newSku = `${p.sku}-${suffix}`

    if (!newUomId) {
      console.log(` ⚠ Skip "${p.name}" — UOM "${uomCode}" not found`)
      continue
    }

    const res = await newClient.query(`
      INSERT INTO petshop.products (sku, name, category_id, brand_id, base_uom_id, is_active, weight_gram)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `, [newSku, p.name, newCatId, null, newUomId, true, weightGram])

    insertedMap[p.id] = res.rows[0].id
    console.log(` ✓ Inserted "${p.name}"  SKU: ${newSku}  new_id: ${res.rows[0].id}`)
  }

  // Get and migrate their prices
  if (Object.keys(insertedMap).length === 0) {
    console.log('\nTidak ada produk yang berhasil diinsert.')
    await oldClient.end(); await newClient.end()
    return
  }

  const oldIds = Object.keys(insertedMap)
  const { rows: prices } = await oldClient.query(`
    SELECT s.product_id, s.uom_id, s.price_category_id, MAX(s.price) as price,
           u.code as uom_code
    FROM public.store_product_uom_price s
    JOIN public.uom u ON u.id = s.uom_id
    WHERE s.store_id = $1
      AND s.deleted_at IS NULL AND s.price > 0
      AND s.product_id = ANY($2)
    GROUP BY s.product_id, s.uom_id, s.price_category_id, u.code
  `, [TOKO_PUSAT, oldIds])

  console.log('\n=== INSERTING PRICES ===')
  let priceCount = 0
  for (const row of prices) {
    const newProductId = insertedMap[row.product_id]
    const newUomId     = newUomByCode[row.uom_code?.trim().toUpperCase()]
    const tierType     = TIER_MAP[row.price_category_id]
    if (!newProductId || !newUomId || !tierType) continue

    await newClient.query(`
      INSERT INTO petshop.product_prices (product_id, branch_id, uom_id, tier_type, price)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT DO NOTHING
    `, [newProductId, BRANCH_ID, newUomId, tierType, Math.round(parseFloat(row.price))])
    priceCount++
  }

  console.log(` ✓ ${priceCount} harga diinsert`)
  console.log('\n=== DONE ===')
  await oldClient.end()
  await newClient.end()
}

main().catch(e => { console.error('Error:', e.message); process.exit(1) })
