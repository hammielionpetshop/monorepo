import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/require-customer';
import { db, eq, customers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const gate = await requireCustomer();
  if (gate instanceof NextResponse) return gate;

  try {
    const [customer] = await db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        address: customers.address,
        defaultTierType: customers.defaultTierType,
      })
      .from(customers)
      .where(eq(customers.id, gate.customerId))
      .limit(1);

    if (!customer) {
      return NextResponse.json({ error: 'Profil tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(customer);
  } catch (error) {
    console.error('me error:', error);
    return NextResponse.json({ error: 'Gagal memuat profil' }, { status: 500 });
  }
}
