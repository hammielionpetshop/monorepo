import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AttendancePayScreen, attendancePayScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L09 Hitungan Kehadiran (spec L4b §4). Orang yang tidak boleh dilihat = tidak ditemukan (KAR-83).
export default async function AttendancePayPage({ params, searchParams }: {
  params: Promise<{ employeeId: string }>; searchParams: Promise<{ periode?: string }>;
}) {
  const actor = await requirePageAnyAction(['salary.view', 'salary.change']);
  if (!actor) return <NoAccess />;
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  const { periode } = await searchParams;
  const data = await attendancePayScreen(actor, Number(employeeId), periode ?? null);
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Hitungan Kehadiran ${data.person.name}`} description="Dari mana tiap rupiah kehadiran, sampai ke hari dan aturannya." actions={<NewBadge feature="fitur/hitungan-kehadiran" />} />
      <AttendancePayScreen {...data} />
    </>
  );
}
