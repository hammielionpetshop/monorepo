import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { GroomerLinksScreen, groomerLinksScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// Pasangkan Groomer & Pengantar (PRD 04 §3.3, spec L4d §4).
export default async function GroomerLinksPage() {
  const actor = await requirePageAnyAction(['bonus.view', 'pos_groomer_link.manage']);
  if (!actor) return <NoAccess />;
  const data = await groomerLinksScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Pasangkan Groomer & Pengantar" description="Nama groomer dan pengantar di kasir milik karyawan siapa, supaya bonusnya tertuju ke orang yang benar." actions={<NewBadge feature="/bonus/pasangkan" />} />
      <GroomerLinksScreen {...data} />
    </>
  );
}
