import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FundsScreen, fundsScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L24 Dana Disiplin dan GAJ-L25 Dana Tidak Hadir (spec L4d §3.4).
export default async function FundsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageAnyAction(['fund.view']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await fundsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Dana Disiplin & Tidak Hadir" description="Satu dana untuk perusahaan: saldo, yang terpesan bonus, dan perkiraan periode berjalan." actions={<NewBadge feature="/dana" />} />
      <FundsScreen {...data} initialTab={q.tab === 'tidak-hadir' ? 'absence' : 'discipline'} />
    </>
  );
}
