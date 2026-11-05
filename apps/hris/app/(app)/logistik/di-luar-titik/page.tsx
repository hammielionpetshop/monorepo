import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { OutsideScreen, outsideScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// Tinjau kiriman di luar titik toko (spec LT1 §17.1 butir 9; LOG-142).
export default async function OutsidePointsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const actor = await requirePageAction('logistics.outside_point.review');
  if (!actor) return <NoAccess />;
  const tab = (await searchParams).tab === 'DONE' ? 'DONE' : 'WAITING';
  const data = await outsideScreen(actor, tab);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Di Luar Titik" description="Kiriman Terkirim yang lokasinya jauh dari titik toko: Wajar atau Tidak wajar." actions={<NewBadge feature="/logistik/di-luar-titik" />} />
      <OutsideScreen tab={tab} {...data} />
    </>
  );
}
