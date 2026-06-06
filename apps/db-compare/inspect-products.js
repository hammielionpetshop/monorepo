import pg from 'pg'
const { Client } = pg

const BASE = { host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432 }

const OLD_TABLES = ['product', 'uom', 'product_uom', 'product_price', 'price_category', 'product_uom_category_price', 'category', 'batch', 'store_product_uom_price']
const NEW_TABLES = ['products', 'units_of_measure', 'product_uom_conversions', 'product_prices', 'product_stocks', 'product_stock_batches', 'categories', 'brands']

async function getTableDetail(client, schema, tables) {
  const res = await client.query(`
    SELECT
      table_name,
      column_name,
      data_type,
      character_maximum_length,
      numeric_precision,
      numeric_scale,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = $1
      AND table_name = ANY($2)
    ORDER BY table_name, ordinal_position
  `, [schema, tables])
  return res.rows
}

async function getSampleData(client, schema, table, limit = 3) {
  try {
    const res = await client.query(`SELECT * FROM "${schema}"."${table}" LIMIT ${limit}`)
    return res.rows
  } catch {
    return []
  }
}

async function getRowCount(client, schema, table) {
  try {
    const res = await client.query(`SELECT COUNT(*) as cnt FROM "${schema}"."${table}"`)
    return parseInt(res.rows[0].cnt)
  } catch {
    return -1
  }
}

function printTable(rows, title) {
  console.log(`\n${'─'.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('─'.repeat(60))
  if (!rows.length) { console.log('  (kosong)'); return }
  const cols = Object.keys(rows[0])
  const widths = cols.map(c => Math.min(Math.max(c.length, ...rows.map(r => String(r[c] ?? '').length)), 30))
  const header = cols.map((c, i) => c.padEnd(widths[i])).join(' | ')
  console.log('  ' + header)
  console.log('  ' + widths.map(w => '-'.repeat(w)).join('-+-'))
  rows.forEach(row => {
    const line = cols.map((c, i) => String(row[c] ?? '').substring(0, widths[i]).padEnd(widths[i])).join(' | ')
    console.log('  ' + line)
  })
}

async function main() {
  const oldClient = new Client({ ...BASE, database: 'hammielion_db' })
  const newClient = new Client({ ...BASE, database: 'petshop_db' })
  await oldClient.connect()
  await newClient.connect()

  console.log('\n' + '═'.repeat(60))
  console.log('  PRODUCT TABLES — DETAILED INSPECTION')
  console.log('═'.repeat(60))

  // === OLD DB ===
  console.log('\n\n' + '█'.repeat(60))
  console.log('  OLD DB (hammielion_db.public)')
  console.log('█'.repeat(60))

  const oldCols = await getTableDetail(oldClient, 'public', OLD_TABLES)
  const oldByTable = {}
  oldCols.forEach(c => {
    if (!oldByTable[c.table_name]) oldByTable[c.table_name] = []
    oldByTable[c.table_name].push(c)
  })

  for (const table of OLD_TABLES) {
    const cols = oldByTable[table] || []
    const count = await getRowCount(oldClient, 'public', table)
    const samples = await getSampleData(oldClient, 'public', table, 3)

    console.log(`\n┌── ${table.toUpperCase()}  (${count} rows)`)
    if (cols.length) {
      cols.forEach(c => {
        let type = c.data_type
        if (c.character_maximum_length) type += `(${c.character_maximum_length})`
        const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
        const def = c.column_default ? `  DEFAULT: ${c.column_default.substring(0, 40)}` : ''
        console.log(`│  ${c.column_name.padEnd(30)} ${type.padEnd(25)} ${nullable}${def}`)
      })
    }
    console.log('└──')

    if (samples.length > 0) {
      printTable(samples, `Sample data: ${table}`)
    }
  }

  // === NEW DB ===
  console.log('\n\n' + '█'.repeat(60))
  console.log('  NEW DB (petshop_db.petshop)')
  console.log('█'.repeat(60))

  const newCols = await getTableDetail(newClient, 'petshop', NEW_TABLES)
  const newByTable = {}
  newCols.forEach(c => {
    if (!newByTable[c.table_name]) newByTable[c.table_name] = []
    newByTable[c.table_name].push(c)
  })

  for (const table of NEW_TABLES) {
    const cols = newByTable[table] || []
    const count = await getRowCount(newClient, 'petshop', table)

    console.log(`\n┌── ${table.toUpperCase()}  (${count} rows)`)
    if (cols.length) {
      cols.forEach(c => {
        let type = c.data_type
        if (c.character_maximum_length) type += `(${c.character_maximum_length})`
        const nullable = c.is_nullable === 'YES' ? 'NULL' : 'NOT NULL'
        const def = c.column_default ? `  DEFAULT: ${c.column_default.substring(0, 40)}` : ''
        console.log(`│  ${c.column_name.padEnd(30)} ${type.padEnd(25)} ${nullable}${def}`)
      })
    }
    console.log('└──')
  }

  await oldClient.end()
  await newClient.end()
}

main().catch(e => { console.error(e.message); process.exit(1) })
