import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SelfDeliveryOfficeScreen, officeTab, selfDeliveryOfficeScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

const idOf = (value?: string) => (value && /^\d+$/.test(value) ? Number(value) : null);

// Antar sendiri sisi kantor (spec LT1 §15.3): daftar per cabang, tutup perjalanan, alihkan PJ, keputusan Gagal, tanda 23.59.
export default async function SelfDeliveryOfficePage({ searchParams }: { searchParams: Promise<{ tab?: string; cabang?: string }> }) {
  const actor = await requirePageAnyAction(['logistics.self_delivery.view', 'logistics.self_delivery.manage']);
  if (!actor) return <NoAccess />;
  const q = await searchParams;
  const data = await selfDeliveryOfficeScreen(actor, { tab: officeTab(q.tab), branchId: idOf(q.cabang) });
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Antar Sendiri · Kantor"
        description="Perjalanan antar sendiri per cabang: tutup, alihkan PJ, putuskan kiriman Gagal, dan pantau tunai."
        actions={<NewBadge feature="/logistik/antar-sendiri/kantor" />}
      />
      <SelfDeliveryOfficeScreen data={data} />
    </>
  );
}
