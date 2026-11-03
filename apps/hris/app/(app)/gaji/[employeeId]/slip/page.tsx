import { notFound } from 'next/navigation';
import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PersonSlipsScreen, personSlipsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Tab Slip di Gaji Seseorang (spec L4e §4).
export default async function PersonSlipsPage({ params }: { params: Promise<{ employeeId: string }> }) {
  const actor = await requirePageAnyAction(['payslip.view']);
  if (!actor) return <NoAccess />;
  const { employeeId } = await params;
  if (!/^\d+$/.test(employeeId)) notFound();
  const data = await personSlipsScreen(actor, Number(employeeId));
  if (!data) notFound();
  return (
    <>
      <PageHeader title={`Slip ${data.person.name}`} description="Slip gaji orang ini per periode." actions={<NewBadge feature="fitur/tab-slip" />} />
      <PersonSlipsScreen {...data} />
    </>
  );
}
