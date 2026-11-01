import { PageHeader } from '@/components/ui/surface';
import { requirePageAction } from '@/lib/authz';
import { NoAccess } from '@/modules/access';
import { SettingsScreen, getSettingsScreen } from '@/modules/settings';

export const dynamic = 'force-dynamic';

// BER-L40 Pengaturan. Baris disaring per hak tiap pengaturan (PRI-32 butir 5).
export default async function SettingsPage() {
  const actor = await requirePageAction('settings.view');
  if (!actor) return <NoAccess />;
  const data = await getSettingsScreen(actor);
  return (
    <>
      <PageHeader
        title="Pengaturan"
        description="Angka aturan HRIS. Tiap perubahan bertanggal berlaku: nilai lama tetap dipakai untuk tanggal lama, dan semuanya tercatat."
      />
      <SettingsScreen data={data} />
    </>
  );
}
