import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { FreeBonusForm, freeBonusFormScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L22 Catat Bonus Bebas (4 langkah, spec L4d §3.1).
export default async function FreeBonusPage() {
  const actor = await requirePageAnyAction(['bonus.record_free', 'bonus.approve_free']);
  if (!actor) return <NoAccess />;
  const data = await freeBonusFormScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Catat Bonus Bebas" description="Orang, jenis dan nominal, alasan, lalu periksa." actions={<NewBadge feature="fitur/catat-bonus-bebas" />} />
      <FreeBonusForm {...data} />
    </>
  );
}
