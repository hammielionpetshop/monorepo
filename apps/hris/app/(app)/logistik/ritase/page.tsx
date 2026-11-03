import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { WagesScreen, wagesScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Ritase per minggu upah Jumat–Kamis (spec L6 §3.7, DRV-19).
export default async function WagesPage({ searchParams }: { searchParams: Promise<{ minggu?: string }> }) {
  const actor = await requirePageAction('logistics.wage.view');
  if (!actor) return <NoAccess />;
  const data = await wagesScreen(actor, (await searchParams).minggu ?? null);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Ritase" description="Ritase kirim dan belanja supplier per orang, dicatat otomatis saat trip Selesai." actions={<NewBadge feature="/logistik/ritase" />} />
      <WagesScreen {...data} />
    </>
  );
}
