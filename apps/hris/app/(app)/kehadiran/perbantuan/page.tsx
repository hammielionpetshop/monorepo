import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { AssistsScreen, assistsScreen } from '@/modules/attendance';

export const dynamic = 'force-dynamic';

// KEH-L11 Daftar Perbantuan.
export default async function AssistsPage({ searchParams }: { searchParams: Promise<{ branch?: string; days?: string }> }) {
  const actor = await requirePageAnyAction(['attendance.assist.view']);
  if (!actor) return <NoAccess />;
  const { branch, days } = await searchParams;
  const data = await assistsScreen(actor, /^\d+$/.test(branch ?? '') ? Number(branch) : null, days === '90' ? 90 : 7);
  return (
    <>
      <PageHeader title="Daftar Perbantuan" description="Siapa membantu di cabang lain, dan yang perlu dicek shiftnya." />
      <AssistsScreen {...data} />
    </>
  );
}
