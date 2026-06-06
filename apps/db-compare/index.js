import pg from 'pg'
const { Client } = pg

const BASE = {
  host: 'server.hammielion.com',
  user: 'admin',
  password: 'Hammielion123!',
  port: 5432,
}

const OLD_DB = { ...BASE, database: 'hammielion_db' }
const NEW_DB = { ...BASE, database: 'petshop_db' }
const OLD_SCHEMA = 'public'
const NEW_SCHEMA = 'petshop'

async function getColumns(client, schema) {
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
    ORDER BY table_name, ordinal_position
  `, [schema])
  return res.rows
}

async function getTables(client, schema) {
  const res = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = $1 AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `, [schema])
  return res.rows.map(r => r.table_name)
}

async function getFKs(client, schema) {
  const res = await client.query(`
    SELECT
      tc.table_name,
      kcu.column_name,
      ccu.table_name AS foreign_table,
      ccu.column_name AS foreign_column,
      tc.constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = $1
    ORDER BY tc.table_name, kcu.column_name
  `, [schema])
  return res.rows
}

function groupByTable(columns) {
  return columns.reduce((acc, col) => {
    if (!acc[col.table_name]) acc[col.table_name] = {}
    acc[col.table_name][col.column_name] = col
    return acc
  }, {})
}

function typeStr(col) {
  let t = col.data_type
  if (col.character_maximum_length) t += `(${col.character_maximum_length})`
  if (col.numeric_precision && col.data_type.includes('numeric')) t += `(${col.numeric_precision},${col.numeric_scale})`
  return t
}

function compareSchemas(oldTables, oldCols, newTables, newCols, oldFKs, newFKs) {
  const oldByTable = groupByTable(oldCols)
  const newByTable = groupByTable(newCols)

  const allOldTables = new Set(oldTables)
  const allNewTables = new Set(newTables)

  const onlyInOld = oldTables.filter(t => !allNewTables.has(t))
  const onlyInNew = newTables.filter(t => !allOldTables.has(t))
  const inBoth = oldTables.filter(t => allNewTables.has(t))

  console.log('\n' + '═'.repeat(70))
  console.log('  DATABASE SCHEMA COMPARISON REPORT')
  console.log('  OLD: hammielion_db.public  →  NEW: petshop_db.petshop')
  console.log('═'.repeat(70))

  // Tables only in old
  if (onlyInOld.length) {
    console.log(`\n🔴 TABLES ONLY IN OLD DB (${onlyInOld.length}) — perlu diputuskan: migrate atau drop`)
    onlyInOld.forEach(t => {
      const cols = Object.keys(oldByTable[t] || {})
      console.log(`   • ${t}  (${cols.length} kolom)`)
    })
  }

  // Tables only in new
  if (onlyInNew.length) {
    console.log(`\n🟢 TABLES ONLY IN NEW DB (${onlyInNew.length}) — tabel baru, perlu data atau kosong`)
    onlyInNew.forEach(t => {
      const cols = Object.keys(newByTable[t] || {})
      console.log(`   • ${t}  (${cols.length} kolom)`)
    })
  }

  // Tables in both — compare columns
  console.log(`\n🔵 TABLES IN BOTH (${inBoth.length}) — detail perbedaan kolom:`)

  let totalDiffs = 0
  inBoth.forEach(table => {
    const oldCols = oldByTable[table] || {}
    const newCols = newByTable[table] || {}
    const allOldCols = new Set(Object.keys(oldCols))
    const allNewCols = new Set(Object.keys(newCols))

    const droppedCols = [...allOldCols].filter(c => !allNewCols.has(c))
    const addedCols = [...allNewCols].filter(c => !allOldCols.has(c))
    const changedCols = [...allOldCols].filter(c => {
      if (!allNewCols.has(c)) return false
      const o = oldCols[c], n = newCols[c]
      return typeStr(o) !== typeStr(n) || o.is_nullable !== n.is_nullable
    })

    const hasDiff = droppedCols.length || addedCols.length || changedCols.length
    totalDiffs += hasDiff ? 1 : 0

    if (hasDiff) {
      console.log(`\n   ┌── ${table}`)
      droppedCols.forEach(c => {
        console.log(`   │  ➖ ${c}  [${typeStr(oldCols[c])}]  (hilang di DB baru)`)
      })
      addedCols.forEach(c => {
        console.log(`   │  ➕ ${c}  [${typeStr(newCols[c])}]  (baru di DB baru)`)
      })
      changedCols.forEach(c => {
        const o = oldCols[c], n = newCols[c]
        const typeDiff = typeStr(o) !== typeStr(n) ? `  type: ${typeStr(o)} → ${typeStr(n)}` : ''
        const nullDiff = o.is_nullable !== n.is_nullable ? `  nullable: ${o.is_nullable} → ${n.is_nullable}` : ''
        console.log(`   │  ✏️  ${c}${typeDiff}${nullDiff}`)
      })
      console.log(`   └──`)
    } else {
      console.log(`   ✅ ${table}  — identik`)
    }
  })

  // FK diff summary
  const oldFKMap = new Set(oldFKs.map(f => `${f.table_name}.${f.column_name}→${f.foreign_table}.${f.foreign_column}`))
  const newFKMap = new Set(newFKs.map(f => `${f.table_name}.${f.column_name}→${f.foreign_table}.${f.foreign_column}`))
  const droppedFKs = [...oldFKMap].filter(f => !newFKMap.has(f))
  const addedFKs = [...newFKMap].filter(f => !oldFKMap.has(f))

  if (droppedFKs.length || addedFKs.length) {
    console.log('\n🔗 FOREIGN KEY CHANGES:')
    droppedFKs.forEach(f => console.log(`   ➖ ${f}`))
    addedFKs.forEach(f => console.log(`   ➕ ${f}`))
  }

  console.log('\n' + '─'.repeat(70))
  console.log(`  SUMMARY`)
  console.log(`  Tabel hanya di old  : ${onlyInOld.length}`)
  console.log(`  Tabel hanya di new  : ${onlyInNew.length}`)
  console.log(`  Tabel ada di keduanya: ${inBoth.length}  (${totalDiffs} ada perbedaan, ${inBoth.length - totalDiffs} identik)`)
  console.log('─'.repeat(70) + '\n')
}

async function main() {
  const oldClient = new Client(OLD_DB)
  const newClient = new Client(NEW_DB)

  try {
    console.log('Connecting to databases...')
    await oldClient.connect()
    await newClient.connect()
    console.log('Connected. Fetching schemas...\n')

    const [oldTables, oldCols, oldFKs, newTables, newCols, newFKs] = await Promise.all([
      getTables(oldClient, OLD_SCHEMA),
      getColumns(oldClient, OLD_SCHEMA),
      getFKs(oldClient, OLD_SCHEMA),
      getTables(newClient, NEW_SCHEMA),
      getColumns(newClient, NEW_SCHEMA),
      getFKs(newClient, NEW_SCHEMA),
    ])

    console.log(`Old DB tables (${OLD_SCHEMA}): ${oldTables.length}`)
    console.log(`New DB tables (${NEW_SCHEMA}): ${newTables.length}`)

    compareSchemas(oldTables, oldCols, newTables, newCols, oldFKs, newFKs)

  } catch (err) {
    console.error('Error:', err.message)
    process.exit(1)
  } finally {
    await oldClient.end()
    await newClient.end()
  }
}

main()
