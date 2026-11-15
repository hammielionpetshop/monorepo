import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SpecialAdvanceForm, specialFormScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// DRV-L37 Buat Kasbon Khusus (spec L5 §3.11): Pemilik/GM, untuk kejadian mendesak di luar batas kasbon biasa.
export default async function SpecialAdvancePage() {
  const actor = await requirePageAnyAction(['advance.manage']);
  if (!actor) return <NoAccess />;
  const data = await specialFormScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Buat Kasbon Khusus" description="Untuk kecelakaan, sakit, duka, atau kejadian lain; tanpa batas orang dan Dana Kasbon." />
      <SpecialAdvanceForm {...data} />
    </>
  );
}
