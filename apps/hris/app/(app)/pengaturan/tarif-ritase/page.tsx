import { NewBadge } from '@/components/ui/new-badge';
import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { RatesScreen, ratesScreen } from '@/modules/logistics';

export const dynamic = 'force-dynamic';

// DRV-L02 s.d. L04 Tarif Ritase (spec L7 §3.1): Pemilik/GM mengubah; HR dan Kepala Gudang melihat.
export default async function RatesPage() {
  const actor = await requirePageAction('wage.rate.view');
  if (!actor) return <NoAccess />;
  const data = await ratesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Tarif Ritase" description="Upah ritase dan upah belanja per pasangan mobil dan rute, bertanggal berlaku." actions={<NewBadge feature="/pengaturan/tarif-ritase" />} />
      <RatesScreen {...data} />
    </>
  );
}
