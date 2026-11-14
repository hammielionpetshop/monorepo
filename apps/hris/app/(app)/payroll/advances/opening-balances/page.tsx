import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { LegacyAdvanceScreen, legacyScreen } from '@/modules/advances';

export const dynamic = 'force-dynamic';

// Sisa Kasbon Bawaan (spec L9 §3.1, SIS-28): Finance mengetik, Pemilik/GM mengesahkan.
export default async function LegacyAdvancePage() {
  const actor = await requirePageAnyAction(['advance.legacy_enter', 'advance.decide']);
  if (!actor) return <NoAccess />;
  const data = await legacyScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader title="Sisa Kasbon Bawaan" description="Sisa kasbon per orang dari sistem lama pada hari pindah. Satu angka per orang, disahkan Pemilik atau GM." />
      <LegacyAdvanceScreen {...data} />
    </>
  );
}
