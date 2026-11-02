import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PayRulesScreen, payRulesScreen } from '@/modules/payroll';

export const dynamic = 'force-dynamic';

// GAJ-L06 Potongan & Lembur (spec L4b §3.1). Pemilik/GM mengubah; yang lain melihat.
export default async function PayRulesPage() {
  const actor = await requirePageAnyAction(['settings.view', 'settings.manage']);
  const data = actor ? await payRulesScreen(actor) : null;
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Potongan & Lembur" description="Angka potongan izin, sakit, alpha, telat, denda, dan tarif lembur." actions={<NewBadge feature="/pengaturan/potongan-lembur" />} />
      <PayRulesScreen {...data} />
    </>
  );
}
