import pg from 'pg'
const { Client } = pg
async function main() {
  const n = new Client({ host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432, database: 'petshop_db' })
  await n.connect()

  const tableCheck = await n.query(`SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'petshop' AND table_name = 'payment_methods') as exists`)
  console.log('Table exists:', tableCheck.rows[0].exists)

  if (tableCheck.rows[0].exists) {
    const cols = await n.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'petshop' AND table_name = 'payment_methods' ORDER BY ordinal_position`)
    console.log('Columns:', cols.rows.map(r => r.column_name + ':' + r.data_type).join(', '))
    const rows = await n.query('SELECT * FROM petshop.payment_methods')
    console.log('Rows:', rows.rows)
  }

  // Also check old DB
  const o = new Client({ host: 'server.hammielion.com', user: 'admin', password: 'Hammielion123!', port: 5432, database: 'hammielion_db' })
  await o.connect()
  const oldPm = await o.query('SELECT id, name FROM public.payment_method ORDER BY name')
  console.log('Old payment_methods:', oldPm.rows)
  await n.end()
  await o.end()
}
main().catch(e => console.error(e.message))
