import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { TeamOvertimeScreen, teamOvertimeScreen, type TeamOvertimeTab } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

const TABS: TeamOvertimeTab[] = ['open', 'soon', 'waiting', 'expired'];
const idOf = (value: string | undefined) => (value && /^\d+$/.test(value) ? Number(value) : null);

// KEH-L42 Lembur Tim.
export default async function TeamOvertimePage({ searchParams }: { searchParams: Promise<{ tab?: string; branch?: string; employee?: string }> }) {
  const actor = await requirePageAnyAction(['overtime.team.view']);
  if (!actor) return <NoAccess />;
  const params = await searchParams;
  const data = await teamOvertimeScreen(actor, {
    tab: TABS.find((tab) => tab === params.tab) ?? 'open', branchId: idOf(params.branch), employeeId: idOf(params.employee),
  });
  return (
    <>
      <PageHeader title="Lembur Tim" description="Siapa yang lembur dan klaim mana yang hampir hangus." />
      <TeamOvertimeScreen {...data} />
    </>
  );
}
