import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { DashboardScreen, logisticsDashboard } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Dashboard Logistik (spec LT1 §17.1 butir 7, 8): bagian yang terlihat mengikuti hak masing-masing orang.
export default async function LogisticsDashboardPage() {
  const actor = await requirePageAnyAction([
    'logistics.dashboard.view', 'logistics.money_check.do', 'logistics.store_payment.view', 'logistics.vehicle_followup.manage', 'logistics.fuel.record',
  ]);
  if (!actor) return <NoAccess />;
  const data = await logisticsDashboard(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Dashboard Logistik" description="Yang perlu perhatian hari ini: berjalan sekarang, pengiriman, uang, mobil & bensin." actions={<NewBadge feature="/logistik/dashboard" />} />
      <DashboardScreen {...data} />
    </>
  );
}
