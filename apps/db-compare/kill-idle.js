import pg from 'pg'
const { Client } = pg

async function main() {
  // Connect sebagai superuser
  const c = new Client({ host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432, database: 'postgres' })
  await c.connect()

  // Lihat semua koneksi aktif
  const stats = await c.query(`
    SELECT datname, state, COUNT(*) as cnt
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
    GROUP BY datname, state
    ORDER BY cnt DESC
  `)
  console.log('Koneksi aktif per database & state:')
  stats.rows.forEach(r => console.log(` ${(r.datname||'(null)').padEnd(20)} ${(r.state||'null').padEnd(12)} ${r.cnt}x`))

  // Kill idle connections di petshop_db dan hammielion_db
  const killed = await c.query(`
    SELECT pg_terminate_backend(pid), datname, state, application_name
    FROM pg_stat_activity
    WHERE pid <> pg_backend_pid()
      AND state IN ('idle', 'idle in transaction')
      AND datname IN ('petshop_db', 'hammielion_db')
  `)
  console.log(`\nDi-terminate: ${killed.rowCount} koneksi idle`)
  killed.rows.forEach(r => console.log(` ${r.datname} / ${r.state} / ${r.application_name}`))

  // Cek sisa koneksi
  const remaining = await c.query(`SELECT COUNT(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid()`)
  console.log(`\nSisa koneksi aktif: ${remaining.rows[0].count}`)

  await c.end()
}

main().catch(e => console.error(e.message))
