
import { db } from './apps/backoffice/lib/db';
import { sql } from 'drizzle-orm';

async function checkTable() {
  try {
    const result = await db.execute(sql`SELECT EXISTS (
   SELECT FROM information_schema.tables 
   WHERE  table_schema = 'petshop'
   AND    table_name   = 'stock_adjustments'
   );`);
    console.log(result.rows);
  } catch (error) {
    console.error('Error checking table:', error);
  } finally {
    process.exit();
  }
}

checkTable();
