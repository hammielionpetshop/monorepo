import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { OTHER_STATUS_LABELS, OtherDeductionsScreen, otherDeductionsScreen, type OtherStatus } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

const idOf = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : null);

// GAJ-L16 Potongan Lain (spec L4c §3.5).
export default async function OtherDeductionsPage({ searchParams }: { searchParams: Promise<{ cabang?: string; status?: string }> }) {
  const actor = await requirePageAnyAction(['other_deduction.view', 'deduction.approve']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const status = (Object.keys(OTHER_STATUS_LABELS) as OtherStatus[]).find((s) => s === q.status) ?? null;
  const data = await otherDeductionsScreen(actor, { status, branchId: idOf(q.cabang) });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Potongan Lain" description="Ganti rugi perorangan yang dicicil 1 sampai 3 kali lewat slip." actions={<NewBadge feature="/potongan/lain" />} />
      <OtherDeductionsScreen {...data} />
    </>
  );
}
