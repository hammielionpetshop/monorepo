import { createDb } from '../index';

const db = createDb(process.env.DATABASE_URL!);
import { expenseCategories } from '../schema/master';

const DEFAULT_CATEGORIES = [
  { name: 'Transport' },
  { name: 'Konsumsi' },
  { name: 'Utilitas' },
  { name: 'Maintenance' },
  { name: 'Supplies' },
  { name: 'Insentif/Tip' },
  { name: 'Lain-lain' },
];

export async function seedExpenseCategories() {
  await db.insert(expenseCategories)
    .values(DEFAULT_CATEGORIES)
    .onConflictDoNothing();
}
