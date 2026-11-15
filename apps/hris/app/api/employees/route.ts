import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMutationAction } from '@/lib/authz';
import { WORK_STATUSES, createEmployee } from '@/modules/employees';

export const dynamic = 'force-dynamic';

const text = z.string().max(500).nullable().optional();
const bodySchema = z.object({
  name: z.string().max(200),
  phone: text, email: text, birthDate: text, gender: text,
  branchId: z.number().int().positive(),
  positionId: z.number().int().positive(),
  workStatus: z.enum(WORK_STATUSES),
  joinedOn: z.string().max(10),
});

// Tambah Karyawan (KAR-60): hanya Pemilik dan GM. Aturan isian diperiksa lagi di layanan.
export async function POST(req: Request) {
  const guard = await requireMutationAction(req, 'employee.create');
  if (!guard.ok) return guard.response;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 });
  const result = await createEmployee(guard.actor, parsed.data);
  return result.ok
    ? NextResponse.json({ ok: true, ...result.data })
    : NextResponse.json({ error: result.error }, { status: result.status });
}
