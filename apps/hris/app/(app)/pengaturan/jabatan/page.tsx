import { PageHeader } from '@/components/ui/surface';
import { requirePageAnyAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { PositionSettingsScreen, getPositionSettingsScreen } from '@/modules/settings';

export const dynamic = 'force-dynamic';

// KAR-L31 Pengaturan Jabatan.
export default async function PositionSettingsPage() {
  const actor = await requirePageAnyAction(['position_settings.propose', 'position_settings.approve']);
  if (!actor) return <NoAccess />;
  const data = await getPositionSettingsScreen(actor);
  if (!data) return <NoAccess />;
  return (
    <>
      <PageHeader
        title="Pengaturan Jabatan"
        description="Tanda per jabatan, bertanggal berlaku. Jabatan tanpa nilai sendiri ikut baris bawaan."
      />
      <PositionSettingsScreen data={data} />
    </>
  );
}
