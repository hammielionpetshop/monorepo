import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { MyAdvancesScreen, myAdvancesScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L23 Kasbon Saya (spec L5 §4). Hanya kasbon orangnya sendiri.
export default async function MyAdvancesPage() {
  const actor = await requirePageAction('profile.view');
  if (!actor) return <NoAccess />;
  const data = await myAdvancesScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Kasbon Saya" description="Pinjam uang kantor, dicicil 1 sampai 3 kali lewat slip gaji." />
      <MyAdvancesScreen cards={data.cards} blocked={data.blocked} />
    </>
  );
}
